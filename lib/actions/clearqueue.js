function clearqueue(player) {
  return player.coordinator.clearQueue()
}

export default function (api) {
  api.registerAction('clearqueue', clearqueue)
}
