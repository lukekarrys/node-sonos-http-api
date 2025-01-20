async function playlist(player, values) {
  const playlistName = decodeURIComponent(values[0])
  await player.coordinator.replaceWithPlaylist(playlistName)
  await player.coordinator.play()
}

export default {
  playlist,
}
