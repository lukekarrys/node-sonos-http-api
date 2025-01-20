async function presetsAction(player, values, { presets }) {
  const value = decodeURIComponent(values[0])

  let preset
  if (value.startsWith('{')) {
    preset = JSON.parse(value)
  } else {
    preset = presets[value]
  }

  if (preset) {
    return player.system.applyPreset(preset)
  }

  return Object.keys(presets)
}

export default {
  preset: presetsAction,
}
