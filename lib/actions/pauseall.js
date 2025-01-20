import logger from '../../sonos-discovery/lib/helpers/logger.js'
import timers from 'timers/promises'
var pausedPlayers = []

async function pauseAll(player, values) {
  logger.debug('pausing all players')
  // save state for resume

  if (values[0] && values[0] > 0) {
    logger.debug('in', values[0], 'minutes')
    await timers.setTimeout(values[0] * 1000 * 60)
    await doPauseAll(player.system)
    return
  }

  return doPauseAll(player.system)
}

async function resumeAll(player, values) {
  logger.debug('resuming all players')

  if (values[0] && values[0] > 0) {
    logger.debug('in', values[0], 'minutes')
    await timers.setTimeout(values[0] * 1000 * 60)
    await doResumeAll(player.system)
    return
  }

  return doResumeAll(player.system)
}

async function doPauseAll(system) {
  pausedPlayers = []
  return Promise.all(
    system.zones
      .filter((zone) => {
        return zone.coordinator.state.playbackState === 'PLAYING'
      })
      .map((zone) => {
        pausedPlayers.push(zone.uuid)
        const player = system.getPlayerByUUID(zone.uuid)
        return player.pause()
      })
  )
}

function doResumeAll(system) {
  const promises = pausedPlayers.map((uuid) => {
    return system.getPlayerByUUID(uuid).play()
  })

  // Clear the pauseState to prevent a second resume to raise hell
  pausedPlayers = []

  return Promise.all(promises)
}

export default {
  pauseall: pauseAll,
  resumeall: resumeAll,
}
