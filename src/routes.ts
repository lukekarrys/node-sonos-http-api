import type { Request, Response } from 'polka'
import type { Methods } from 'trouter'
import type { SonosDevice, SonosManager } from '@svrooij/sonos'
import { type StrongSonosEvents } from '@svrooij/sonos/lib/models/strong-sonos-events.js'
import { PlayMode } from '@svrooij/sonos/lib/models/playmode.js'
import { MetaDataHelper, SonosEvents } from '@svrooij/sonos'
import { json, empty, sse, jsonError, invalidParam } from './send.ts'
import {
  getPlayMode,
  normalizeDeviceName,
  playModes,
  runAction,
  runActions,
} from './sonos.ts'

const deviceSse = <
  TEvent extends SonosEvents,
  THandler extends StrongSonosEvents[TEvent],
  TData extends Parameters<THandler>[0]
>(
  device: SonosDevice,
  req: Request,
  res: Response,
  event: TEvent,
  cb: (data: TData) => object
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
  { play, playMode }: { play?: boolean; playMode?: PlayMode }
) =>
  runActions([
    () =>
      device.AVTransportService.RemoveAllTracksFromQueue({
        InstanceID: 0,
      }),
    playMode
      ? () =>
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
  >
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
      manager.Devices.map((d) => normalizeDeviceName(d.Name))
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
    const { param = '' } = req.params
    const playMode = getPlayMode(param)
    if (!playMode) {
      return invalidParam(res, param, playModes)
    }
    return deviceNoContent(
      device.AVTransportService.SetPlayMode({
        InstanceID: 0,
        NewPlayMode: playMode,
      }),
      res
    )
  },

  // ==========================
  // Play music URIs
  // ==========================

  'POST /replace-queue/:param': async (device, req, res) => {
    // https://sonos-ts.svrooij.io/sonos-device/methods.html#metadata
    const { param = '' } = req.params

    if (!param) {
      return invalidParam(res, param, ['*'])
    }

    let playMode: PlayMode | undefined
    if (req.body.playMode) {
      playMode = getPlayMode(req.body.playMode)
      if (!playMode) {
        return invalidParam(res, req.body.playMode, playModes)
      }
    }

    return deviceNoContent(
      replaceQueueWithURI(device, param, {
        play: req.body.play,
        playMode,
      }),
      res
    )
  },
  'POST /replace-queue': async (device, req, res) => {
    const url = new URL(req.body.url)

    let playMode: PlayMode | undefined
    if (req.body.playMode) {
      playMode = getPlayMode(req.body.playMode)
      if (!playMode) {
        return invalidParam(res, req.body.playMode, playModes)
      }
    }

    let shuffleOnType: 'album' | 'playlist' | undefined
    if (req.body.shuffleOnType) {
      shuffleOnType = req.body.shuffleOnType as 'album' | 'playlist'
      if (!['album', 'playlist'].includes(shuffleOnType)) {
        return invalidParam(res, req.body.shuffleOnType, ['album', 'playlist'])
      }
    }

    let uri: string | undefined

    if (url.hostname === 'music.apple.com') {
      // Remove the leading slash and remove the first segment which is the language eg /us/
      const path = url.pathname.replace(/^\//, '').split('/').slice(1)
      if (path[0] === 'album' && url.searchParams.has('i')) {
        // /us/album/i-dont-believe-you/7058188?i=7058195
        uri = `apple:track:${url.searchParams.get('i')}`
      } else if (path[0] === 'album') {
        // /us/album/i/7058188
        uri = `apple:album:${path.at(-1)}`
        if (shuffleOnType === 'album') {
          playMode = PlayMode.Shuffle
        }
      } else if (path[0] === 'playlist') {
        // /us/playlist/favorites-mix/pl.pm-20e9f373919da080fd28bc99b185f60f
        uri = `apple:playlist:${path.at(-1)}`
        if (shuffleOnType === 'playlist') {
          playMode = PlayMode.Shuffle
        }
      }
    }

    if (uri) {
      return deviceNoContent(
        replaceQueueWithURI(device, uri, {
          play: req.body.play,
          playMode,
        }),
        res
      )
    }

    return jsonError(res, 400, `Invalid Apple Music URL: ${url}`)
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
