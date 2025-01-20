function mute(player) {
  return player.mute()
}

function groupMute(player) {
  return player.coordinator.muteGroup()
}

function unmute(player) {
  return player.unMute()
}

function groupUnmute(player) {
  return player.coordinator.unMuteGroup()
}

async function toggleMute(player) {
  if (player.state.mute) {
    await player.unMute()
    return { status: 'success', muted: false }
  }

  await player.mute()
  return { status: 'success', muted: true }
}

export default {
  mute,
  unmute,
  groupmute: groupMute,
  groupunmute: groupUnmute,
  mutegroup: groupMute,
  unmutegroup: groupUnmute,
  togglemute: toggleMute,
}
