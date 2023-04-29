'use strict';

function simplifyPlayer(player) {
  return {
    uuid: player.uuid,
    state: player.state,
    playMode: player.currentPlayMode,
    roomName: player.roomName,
    coordinator: player.coordinator.uuid,
    groupState: player.groupState
  };
}

function simplifyZones(zones, values) {
  const action = values[0];
  return zones.map((zone) => {
    if (action === 'names') {
      return {
        uuid: zone.uuid,
        roomName: zone.coordinator.roomName,
      };
    }
    return {
      uuid: zone.uuid,
      coordinator: simplifyPlayer(zone.coordinator),
      members: zone.members.map(simplifyPlayer)
    };
  });
};

function zones(player, values) {
  return Promise.resolve(simplifyZones(player.system.zones, values));
}

module.exports = function (api) {
  api.registerAction('zones', zones);
}