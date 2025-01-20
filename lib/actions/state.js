function state(player) {
  return Promise.resolve(player.state)
}

export default function (api) {
  api.registerAction('state', state)
}
