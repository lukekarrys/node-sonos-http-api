function playlists(player, values) {
  const playlists = player.system.getPlaylists()

  if (values[0] === 'detailed') {
    return playlists
  }

  // only present relevant data
  return playlists.map((i) => i.title)
}

export default {
  playlists,
}
