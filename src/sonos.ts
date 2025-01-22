import { SonosManager } from '@svrooij/sonos'
import { PlayMode } from '@svrooij/sonos/lib/models/playmode.js'

const PLAY_MODES = {
  normal: PlayMode.Normal,
  'repeat-all': PlayMode.RepeatAll,
  'repeat-one': PlayMode.RepeatOne,
  shuffle: PlayMode.Shuffle,
  'shuffle-no-repeat': PlayMode.ShuffleNoRepeat,
  'shuffle-repeat-one': PlayMode.ShuffleRepeatOne,
} as const

export const playModes = Object.keys(PLAY_MODES)

export const manager = new SonosManager()

export const normalizeDeviceName = (name: string) =>
  name.toLowerCase().replaceAll(`'`, '').replaceAll(' ', '-')

export const findDeviceByName = (name: string | undefined) => {
  const deviceId = normalizeDeviceName(decodeURIComponent(name ?? ''))
  const devices = new Map(
    manager.Devices.map((d) => [normalizeDeviceName(d.Name), d]),
  )

  return [devices.get(deviceId), [...devices.keys()]] as const
}

export const getPlayMode = (mode: string) => {
  const playMode =
    mode in PLAY_MODES ? PLAY_MODES[mode as keyof typeof PLAY_MODES] : null

  if (!playMode) {
    return undefined
  }

  return playMode
}

export const runAction = async (action: Promise<boolean>) => {
  const res = await action
  if (res === false) {
    throw new Error('action returned false indicating it did not succeed')
  }
  return true
}

export const runActions = async (
  actions: ((() => Promise<unknown>) | null)[],
) => {
  for (const action of actions) {
    if (action === null) {
      continue
    }
    const res = await action()
    if (res === false) {
      throw new Error('action returned false indicating it did not succeed')
    }
  }
  return true
}
