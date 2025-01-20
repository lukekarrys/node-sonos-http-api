function next(player) {
  return player.coordinator.nextTrack()
}

function previous(player) {
  return player.coordinator.previousTrack()
}

export default {
  next,
  previous,
}
