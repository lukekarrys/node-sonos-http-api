function presetsAction(player, values, { presets }) {
  const value = decodeURIComponent(values[0])
  let preset
  if (value.startsWith('{')) {
    preset = JSON.parse(value)
  } else {
    preset = presets[value]
  }

  if (preset) {
    return player.system.applyPreset(preset)
  } else {
    const simplePresets = Object.keys(presets)
    return Promise.resolve(simplePresets)
  }
}

export default function (api) {
  api.registerAction('preset', presetsAction)
}
