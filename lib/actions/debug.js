import { readFileSync } from 'fs'
import { join } from 'path'

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8')
)

function debug(player) {
  return {
    version: pkg.version,
    system: {
      localEndpoint: player.system.localEndpoint,
      availableServices: player.system.availableServices,
    },
    players: player.system.players.map((x) => ({
      roomName: x.roomName,
      uuid: x.uuid,
      coordinator: x.coordinator.uuid,
      avTransportUri: x.avTransportUri,
      avTransportUriMetadata: x.avTransportUriMetadata,
      enqueuedTransportUri: x.enqueuedTransportUri,
      enqueuedTransportUriMetadata: x.enqueuedTransportUriMetadata,
      baseUrl: x.baseUrl,
      state: x._state,
    })),
  }
}

export default {
  debug,
}
