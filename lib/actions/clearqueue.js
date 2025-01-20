function clearqueue(player) {
  return player.coordinator.clearQueue()
}

export default {
  clearqueue: clearqueue,
}
