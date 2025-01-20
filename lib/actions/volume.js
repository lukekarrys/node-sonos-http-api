function volume(player, values) {
  var volume = values[0]
  return player.setVolume(volume)
}

function groupVolume(player, values) {
  return player.coordinator.setGroupVolume(values[0])
}

export default {
  volume: volume,
  groupvolume: groupVolume,
}
