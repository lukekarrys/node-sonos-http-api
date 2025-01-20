function next(player) {
  return player.coordinator.nextTrack()
}

function previous(player) {
  return player.coordinator.previousTrack()
}

export default function (api) {
  api.registerAction('next', next)
  api.registerAction('previous', previous)
}
