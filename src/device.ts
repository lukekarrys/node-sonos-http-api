import polka, { type Request, type Response, type NextHandler } from 'polka'
import type { Methods } from 'trouter'
import { type SonosDevice } from '@svrooij/sonos'
import { type StrongSonosEvents } from '@svrooij/sonos/lib/models/strong-sonos-events.js'
import { type AVTransportServiceEvent } from '@svrooij/sonos/lib/services/av-transport.service.js'
import { PlayMode, Repeat } from '@svrooij/sonos/lib/models/playmode.js'
import { type Track } from '@svrooij/sonos/lib/models/track.js'
import { SonosEvents } from '@svrooij/sonos'
import {
  json,
  empty,
  jsonError,
  invalidParam,
  invalidBodyOrParams,
} from './send.ts'
import { Devices, PLAY_MODES, runAction, runActions } from './sonos.ts'
import { z } from 'zod'

export { type SonosDevice } from '@svrooij/sonos'

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

const processMusicUrl = (urlString: string) => {
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
  const write = (data: string) =>
    void res.write(`${data.startsWith(':') ? data : `data: ${data}`}\n\n`)

  const handler = ((data: TData) => write(JSON.stringify(cb(data)))) as THandler

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  device.Events.on(event, handler)

  const hb = setInterval(() => write(':heartbeat'), 30 * 1000)

  req.on('close', () => {
    clearInterval(hb)
    device.Events.off(event, handler)
    res.end()
  })
}

// Helper to convert PlayMode to shuffle/repeat format expected by Arduino
// Logic from PlayModeHelper (avoiding import issues with CJS/ESM)
const computeShuffle = (playMode: PlayMode): boolean =>
  [
    PlayMode.Shuffle,
    PlayMode.ShuffleNoRepeat,
    PlayMode.ShuffleRepeatOne,
  ].includes(playMode)

const computeRepeat = (playMode: PlayMode): Repeat => {
  switch (playMode) {
    case PlayMode.RepeatAll:
    case PlayMode.Shuffle:
      return Repeat.RepeatAll
    case PlayMode.RepeatOne:
    case PlayMode.ShuffleRepeatOne:
      return Repeat.RepeatOne
    case PlayMode.Normal:
    case PlayMode.ShuffleNoRepeat:
    default:
      return Repeat.Off
  }
}

const parsePlayMode = (playMode: PlayMode | undefined) => ({
  shuffle: playMode ? computeShuffle(playMode) : false,
  repeat: playMode ? computeRepeat(playMode) : Repeat.Off,
})

// Helper to extract track info from Track object
const parseTrack = (track: Track | string | undefined) => {
  if (!track || typeof track === 'string') {
    return { artist: '', title: '', album: '' }
  }
  return {
    artist: track.Artist ?? '',
    title: track.Title ?? '',
    album: track.Album ?? '',
  }
}

// Type for the full state sent to Arduino
type ArduinoTransportState = {
  type: 'transport-state'
  data: {
    state: {
      volume: number
      mute: boolean
      currentTrack: { artist: string; title: string; album: string }
      playMode: { shuffle: boolean; repeat: Repeat }
      playbackState: string
    }
  }
}

type ArduinoVolumeChange = {
  type: 'volume-change'
  data: { newVolume: number }
}

type ArduinoMuteChange = {
  type: 'mute-change'
  data: { newMute: boolean }
}

type ArduinoEvent =
  | ArduinoTransportState
  | ArduinoVolumeChange
  | ArduinoMuteChange

// Multi-event SSE for full device state (used by Arduino)
const deviceEventsSse = (device: SonosDevice, req: Request, res: Response) => {
  // Current state tracking
  let currentState = {
    volume: 0,
    mute: false,
    currentTrack: { artist: '', title: '', album: '' },
    playMode: { shuffle: false, repeat: Repeat.Off as Repeat },
    playbackState: 'STOPPED',
  }

  const write = (data: string) =>
    void res.write(`${data.startsWith(':') ? data : `data: ${data}`}\n\n`)

  const sendEvent = (event: ArduinoEvent) => write(JSON.stringify(event))

  const sendFullState = () => {
    sendEvent({
      type: 'transport-state',
      data: { state: currentState },
    })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  // Handler for volume changes
  const volumeHandler = (volume: number) => {
    currentState.volume = volume
    sendEvent({ type: 'volume-change', data: { newVolume: volume } })
  }

  // Handler for mute changes
  const muteHandler = (mute: boolean) => {
    currentState.mute = mute
    sendEvent({ type: 'mute-change', data: { newMute: mute } })
  }

  // Handler for AVTransport events (contains track, playmode, transport state)
  const avtransportHandler = (data: AVTransportServiceEvent) => {
    let hasChange = false

    // Update transport state if present
    if (data.CurrentTransportActions !== undefined) {
      // CurrentTransportActions contains things like "Play,Pause,Stop,Next,Previous"
      // But we need the actual playback state from elsewhere
    }

    // Check for track changes
    if (data.CurrentTrackMetaData !== undefined) {
      const newTrack = parseTrack(data.CurrentTrackMetaData)
      if (
        newTrack.artist !== currentState.currentTrack.artist ||
        newTrack.title !== currentState.currentTrack.title ||
        newTrack.album !== currentState.currentTrack.album
      ) {
        currentState.currentTrack = newTrack
        hasChange = true
      }
    }

    // Check for playmode changes
    if (data.CurrentPlayMode !== undefined) {
      const newPlayMode = parsePlayMode(data.CurrentPlayMode)
      if (
        newPlayMode.shuffle !== currentState.playMode.shuffle ||
        newPlayMode.repeat !== currentState.playMode.repeat
      ) {
        currentState.playMode = newPlayMode
        hasChange = true
      }
    }

    if (hasChange) {
      sendFullState()
    }
  }

  // Handler for transport state changes (PLAYING, PAUSED, STOPPED, etc)
  const transportStateHandler = (state: string) => {
    if (state !== currentState.playbackState) {
      currentState.playbackState = state
      sendFullState()
    }
  }

  // Subscribe to all relevant events
  device.Events.on(SonosEvents.Volume, volumeHandler)
  device.Events.on(SonosEvents.Mute, muteHandler)
  device.Events.on(SonosEvents.AVTransport, avtransportHandler)
  device.Events.on(SonosEvents.CurrentTransportState, transportStateHandler)

  const hb = setInterval(() => write(':heartbeat'), 30 * 1000)

  // Fetch initial state and send it
  Promise.all([
    device.GetState(),
    device.AVTransportService.GetTransportSettings({ InstanceID: 0 }),
  ])
    .then(([state, transportSettings]) => {
      // Get track from positionInfo
      const track = state.positionInfo?.TrackMetaData
      currentState = {
        volume: state.volume ?? 0,
        mute: state.muted ?? false,
        currentTrack: parseTrack(track),
        playMode: parsePlayMode(transportSettings.PlayMode),
        playbackState: state.transportState ?? 'STOPPED',
      }
      sendFullState()
    })
    .catch((err) => {
      console.error('Failed to get initial state:', err)
      // Send empty state anyway
      sendFullState()
    })

  req.on('close', () => {
    clearInterval(hb)
    device.Events.off(SonosEvents.Volume, volumeHandler)
    device.Events.off(SonosEvents.Mute, muteHandler)
    device.Events.off(SonosEvents.AVTransport, avtransportHandler)
    device.Events.off(SonosEvents.CurrentTransportState, transportStateHandler)
    res.end()
  })
}

const deviceNoContent = async (p: () => Promise<boolean>, res: Response) => {
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

const deviceRoutes: Record<
  `${Methods} /${string}`,
  (arg1: SonosDevice, req: Request, res: Response) => Promise<void> | void
> = {
  // ==========================
  // Playback actions
  // ==========================

  'POST /play': async (device, req, res) => {
    return deviceNoContent(() => device.Play(), res)
  },
  'POST /pause': async (device, req, res) => {
    return deviceNoContent(() => device.Pause(), res)
  },
  'POST /toggle-playback': async (device, req, res) => {
    return deviceNoContent(() => device.TogglePlayback(), res)
  },
  'POST /next': async (device, req, res) => {
    return deviceNoContent(() => device.Next(), res)
  },
  'POST /prev': async (device, req, res) => {
    return deviceNoContent(() => device.Previous(), res)
  },
  'POST /playmode/:param': async (device, req, res) => {
    const p = playModeSchema.safeParse(req.params.param)
    if (!p.success) {
      return invalidParam(res, req.params.param, Object.keys(PLAY_MODES))
    }
    return deviceNoContent(
      () =>
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
      () =>
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
      () =>
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
  // Arduino GET routes (simple GET actions)
  // ==========================

  'GET /previous': async (device, req, res) => {
    return deviceNoContent(() => device.Previous(), res)
  },
  'GET /next': async (device, req, res) => {
    return deviceNoContent(() => device.Next(), res)
  },
  'GET /playpause': async (device, req, res) => {
    return deviceNoContent(() => device.TogglePlayback(), res)
  },
  'GET /togglemute': async (device, req, res) => {
    try {
      const { CurrentMute } = await device.RenderingControlService.GetMute({
        InstanceID: 0,
        Channel: 'Master',
      })
      await device.RenderingControlService.SetMute({
        InstanceID: 0,
        Channel: 'Master',
        DesiredMute: !CurrentMute,
      })
      return empty(res)
    } catch (err) {
      return jsonError(res, 500, 'Failed to toggle mute', err)
    }
  },
  'GET /volume/:delta': async (device, req, res) => {
    const delta = parseInt(req.params.delta ?? '', 10)
    if (isNaN(delta)) {
      return invalidParam(res, 'delta', ['integer like -1, +1, -5, +5'])
    }
    try {
      await device.SetRelativeVolume(delta)
      return empty(res)
    } catch (err) {
      return jsonError(res, 500, 'Failed to adjust volume', err)
    }
  },
  'GET /shuffle/toggle': async (device, req, res) => {
    try {
      const { PlayMode: currentPlayMode } =
        await device.AVTransportService.GetTransportSettings({ InstanceID: 0 })
      const currentShuffle = computeShuffle(currentPlayMode)
      await device.SetShuffle(!currentShuffle)
      return empty(res)
    } catch (err) {
      return jsonError(res, 500, 'Failed to toggle shuffle', err)
    }
  },
  'GET /repeat/toggle': async (device, req, res) => {
    try {
      const { PlayMode: currentPlayMode } =
        await device.AVTransportService.GetTransportSettings({ InstanceID: 0 })
      const currentRepeat = computeRepeat(currentPlayMode)
      // Cycle: Off -> RepeatAll -> RepeatOne -> Off
      const nextRepeat =
        currentRepeat === Repeat.Off ? Repeat.RepeatAll
        : currentRepeat === Repeat.RepeatAll ? Repeat.RepeatOne
        : Repeat.Off
      await device.SetRepeat(nextRepeat)
      return empty(res)
    } catch (err) {
      return jsonError(res, 500, 'Failed to toggle repeat', err)
    }
  },
  'GET /trackseek/:track': async (device, req, res) => {
    const track = parseInt(req.params.track ?? '', 10)
    if (isNaN(track) || track < 1) {
      return invalidParam(res, 'track', ['positive integer'])
    }
    return deviceNoContent(() => device.SeekTrack(track), res)
  },

  // ==========================
  // Server-Sent Events Routes
  // ==========================

  'GET /events/volume': (device, req, res) => {
    deviceSse(device, req, res, SonosEvents.Volume, (volume) => ({ volume }))
  },

  // Full events route for Arduino - provides transport-state, volume-change, mute-change events
  'GET /events': (device, req, res) => {
    deviceEventsSse(device, req, res)
  },
}

const DEVICE_KEY = 'deviceKey'

const app = polka<Request & { device?: SonosDevice }>().use(
  (
    req: Request & { device?: SonosDevice },
    res: Response,
    next: NextHandler,
  ) => {
    const param = req.params[DEVICE_KEY]
    req.device = param ? Devices.findByName(param) : undefined
    return next()
  },
)

for (const [key, handler] of Object.entries(deviceRoutes)) {
  const [method, path] = key.split(' ')
  app.add(method as Methods, `/:${DEVICE_KEY}${path}`, async (req, res) => {
    if (!req.device) {
      return invalidParam(res, DEVICE_KEY, Devices.getNames())
    }
    const start = Date.now()
    await handler(req.device, req, res)
    console.log(
      'RES',
      req.method,
      '/d' + req.url,
      res.statusCode,
      `${Date.now() - start}ms`,
    )
  })
}

export default app
