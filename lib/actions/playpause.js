function playpause(player) {
  let ret = { status: 'success', paused: false }

  if (player.coordinator.state.playbackState === 'PLAYING') {
    ret.paused = true
    return player.coordinator.pause().then(() => {
      return ret
    })
  }

  return player.coordinator.play().then(() => {
    return ret
  })
}

function play(player) {
  return player.coordinator.play()
}

function pause(player) {
  return player.coordinator.pause()
}

export default {
  playpause,
  play,
  pause,
}
