function playlist(player, values) {
  const playlistName = decodeURIComponent(values[0])
  return player.coordinator
    .replaceWithPlaylist(playlistName)
    .then(() => player.coordinator.play())
}

export default function (api) {
  api.registerAction('playlist', playlist)
}
