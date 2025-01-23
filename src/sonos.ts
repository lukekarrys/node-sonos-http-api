import { SonosManager } from '@svrooij/sonos'
import { PlayMode } from '@svrooij/sonos/lib/models/playmode.js'

export const PLAY_MODES = {
  normal: PlayMode.Normal,
  'repeat-all': PlayMode.RepeatAll,
  'repeat-one': PlayMode.RepeatOne,
  shuffle: PlayMode.Shuffle,
  'shuffle-no-repeat': PlayMode.ShuffleNoRepeat,
  'shuffle-repeat-one': PlayMode.ShuffleRepeatOne,
} as const

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

const logAction = async <T>(action: () => Promise<T>) => {
  const start = Date.now()
  const res = await action()
  let log = `SONOS (${Date.now() - start}ms)`
  try {
    log += ` ${action.toString().replaceAll(/\n/g, '').replaceAll(/\s+/g, ' ').replace(`() => `, '')}`
  } catch {
    log += ` [unknown action]`
    // this could error if new actions are added that dont work. so just to be safe dont log those
  }
  console.log(log)
  return res
}

export const runAction = async (action: () => Promise<boolean>) => {
  const res = await logAction(action)
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
    const res = await logAction(action)
    if (res === false) {
      throw new Error('action returned false indicating it did not succeed')
    }
  }
  return true
}
