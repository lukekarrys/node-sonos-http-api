async function playpause(player) {
  if (player.coordinator.state.playbackState === 'PLAYING') {
    await player.coordinator.pause()
    return { status: 'success', paused: true }
  }

  await player.coordinator.play()
  return { status: 'success', paused: false }
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
