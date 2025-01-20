async function repeat(player, values) {
  let mode = values[0]

  if (mode === 'on') {
    mode = 'all'
  } else if (mode === 'off') {
    mode = 'none'
  } else if (mode === 'toggle') {
    switch (player.coordinator.state.playMode.repeat) {
      case 'all':
        mode = 'one'
        break
      case 'one':
        mode = 'off'
        break
      default:
        mode = 'all'
    }
  }

  await player.coordinator.repeat(mode)
  return { status: 'success', repeat: mode }
}

async function shuffle(player, values) {
  let enable = values[0] === 'on'
  if (values[0] == 'toggle') enable = !player.coordinator.state.playMode.shuffle
  await player.coordinator.shuffle(enable)
  return { status: 'success', shuffle: enable }
}

async function crossfade(player, values) {
  let enable = values[0] === 'on'
  if (values[0] == 'toggle') {
    enable = !player.coordinator.state.playMode.crossfade
  }
  await player.coordinator.crossfade(enable)
  return { status: 'success', crossfade: enable }
}

export default {
  repeat,
  shuffle,
  crossfade,
}
