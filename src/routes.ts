import type { Request, Response } from 'polka'
import type { Methods } from 'trouter'
import type { SonosDevice, SonosManager } from '@svrooij/sonos'
import { type StrongSonosEvents } from '@svrooij/sonos/lib/models/strong-sonos-events.js'
import { PlayMode } from '@svrooij/sonos/lib/models/playmode.js'
import { SonosEvents } from '@svrooij/sonos'
import {
  json,
  empty,
  sse,
  jsonError,
  invalidParam,
  invalidBodyOrParams,
} from './send.ts'
import {
  PLAY_MODES,
  normalizeDeviceName,
  runAction,
  runActions,
} from './sonos.ts'
import { z } from 'zod'

const playModeSchema = z
  .string()
  .refine(
    (v): v is keyof typeof PLAY_MODES => Object.keys(PLAY_MODES).includes(v),
    {
      message: 'Invalid playMode',
    },
  )
  .transform((v) => PLAY_MODES[v])

const bodySchema = z.object({
  play: z.optional(
    z
      .string()
      .refine((value) => value === 'true' || value === 'false', {
        message: 'Value must be a boolean',
      })
      .transform((value) => value === 'true'),
  ),
  shuffleOnType: z.optional(
    z.union([z.literal('album'), z.literal('playlist')]),
  ),
  playMode: z.optional(playModeSchema),
})

function processMusicUrl(urlString: string) {
  const url = new URL(urlString)

  if (url.hostname === 'music.apple.com') {
    const path = url.pathname.replace(/^\//, '').split('/').slice(1)

    if (path[0] === 'album' && url.searchParams.has('i')) {
      return {
        service: 'apple',
        type: 'track',
        id: url.searchParams.get('i')!,
      }
    }

    if (path[0] === 'album' && path.at(-1)) {
      return {
        service: 'apple',
        type: 'album',
        id: path.at(-1)!,
      }
    }

    if (path[0] === 'playlist' && path.at(-1)) {
      return {
        service: 'apple',
        type: 'playlist',
        id: path.at(-1)!,
      }
    }
  }

  throw new Error('Invalid music URL')
}

const bodyWithUrlSchema = bodySchema.extend({
  url: z
    .string()
    .url()
    .refine(
      (v) => {
        try {
          processMusicUrl(v)
          return true
        } catch {
          return false
        }
      },
      {
        message: 'Invalid music URL',
      },
    )
    .transform((v) => processMusicUrl(v)),
})

const bodyWithParamSchema = bodySchema.extend({
  // https://sonos-ts.svrooij.io/sonos-device/methods.html#metadata
  param: z.string(),
})

const deviceSse = <
  TEvent extends SonosEvents,
  THandler extends StrongSonosEvents[TEvent],
  TData extends Parameters<THandler>[0],
>(
  device: SonosDevice,
  req: Request,
  res: Response,
  event: TEvent,
  cb: (data: TData) => object,
) => {
  const write = sse(req, res)
  device.Events.on(event, ((data: TData) =>
    write(JSON.stringify(cb(data)))) as THandler)
}

const deviceNoContent = async (p: Promise<boolean>, res: Response) => {
  try {
    await runAction(p)
    return empty(res)
  } catch (err) {
    return jsonError(res, 500, 'Failed to execute action', err)
  }
}

const replaceQueueWithURI = async (
  device: SonosDevice,
  uri: string,
  { play, playMode }: { play?: boolean; playMode?: PlayMode },
) =>
  runActions([
    () =>
      device.AVTransportService.RemoveAllTracksFromQueue({
        InstanceID: 0,
      }),
    playMode ?
      () =>
        device.AVTransportService.SetPlayMode({
          InstanceID: 0,
          NewPlayMode: playMode,
        })
    : null,
    () => device.AddUriToQueue(uri).then((r) => Boolean(r)),
    play ? () => device.Play() : null,
  ])

const splitRoutes = <T>(
  routes: Record<
    `${Methods} /${string}`,
    (arg1: T, req: Request, res: Response) => Promise<void> | void
  >,
) =>
  Object.entries(routes).map(([key, handler]) => {
    const [method, path] = key.split(' ')
    return [method as Methods, path!, handler] as const
  })

export const managerRoutes = splitRoutes<SonosManager>({
  'GET /devices': (manager, req, res) => json(res, 200, manager.Devices),
  'GET /devices/name': (manager, req, res) =>
    json(
      res,
      200,
      manager.Devices.map((d) => normalizeDeviceName(d.Name)),
    ),
})

export const deviceRoutes = splitRoutes<SonosDevice>({
  // ==========================
  // Playback actions
  // ==========================

  'POST /play': async (device, req, res) => {
    return deviceNoContent(device.Play(), res)
  },
  'POST /pause': async (device, req, res) => {
    return deviceNoContent(device.Pause(), res)
  },
  'POST /toggle-playback': async (device, req, res) => {
    return deviceNoContent(device.TogglePlayback(), res)
  },
  'POST /next': async (device, req, res) => {
    return deviceNoContent(device.Next(), res)
  },
  'POST /prev': async (device, req, res) => {
    return deviceNoContent(device.Previous(), res)
  },
  'POST /playmode/:param': async (device, req, res) => {
    const p = playModeSchema.safeParse(req.params.param)
    if (!p.success) {
      return invalidParam(res, req.params.param, Object.keys(PLAY_MODES))
    }
    return deviceNoContent(
      device.AVTransportService.SetPlayMode({
        InstanceID: 0,
        NewPlayMode: p.data,
      }),
      res,
    )
  },

  // ==========================
  // Play music URIs
  // ==========================

  'POST /replace-queue/:param': async (device, req, res) => {
    const p = bodyWithParamSchema.safeParse({ ...req.params, ...req.body })
    if (!p.success) {
      return invalidBodyOrParams(res, req, p.error)
    }
    const { data } = p
    return deviceNoContent(
      replaceQueueWithURI(device, data.param, {
        play: data.play,
        playMode: data.playMode,
      }),
      res,
    )
  },
  'POST /replace-queue': async (device, req, res) => {
    const p = bodyWithUrlSchema.safeParse(req.body)
    if (!p.success) {
      return invalidBodyOrParams(res, req, p.error)
    }
    const { data } = p
    if (data.url.type === data.shuffleOnType) {
      data.playMode = PLAY_MODES.shuffle
    }
    return deviceNoContent(
      replaceQueueWithURI(
        device,
        `${data.url.service}:${data.url.type}:${data.url.id}`,
        {
          play: data.play,
          playMode: data.playMode,
        },
      ),
      res,
    )
  },

  // ==========================
  // Getters
  // ==========================

  'GET /info': async (device, req, res) => {
    json(res, 200, await device.GetState())
  },
  'GET /queue': async (device, req, res) => {
    json(res, 200, await device.GetQueue())
  },

  // ==========================
  // Server-Sent Events Routes
  // ==========================

  'GET /events/volume': (device, req, res) => {
    deviceSse(device, req, res, SonosEvents.Volume, (volume) => ({ volume }))
  },
})
