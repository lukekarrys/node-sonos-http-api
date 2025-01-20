import fs from 'fs'
import path from 'path'
import logger from '../sonos-discovery/lib/helpers/logger.js'
import HttpEventServer from './http-event-server.js'
import SonosSystem from '../sonos-discovery/lib/SonosSystem.js'

import appleMusic from './actions/appleMusic.js'
import clearqueue from './actions/clearqueue.js'
import debug from './actions/debug.js'
import mute from './actions/mute.js'
import nextprevious from './actions/nextprevious.js'
import pauseall from './actions/pauseall.js'
import playlist from './actions/playlist.js'
import playlists from './actions/playlists.js'
import playmode from './actions/playmode.js'
import playpause from './actions/playpause.js'
import preset from './actions/preset.js'
import queue from './actions/queue.js'
import seek from './actions/seek.js'
import state from './actions/state.js'
import volume from './actions/volume.js'
import zones from './actions/zones.js'

export default class HttpAPI {
  #actions = {
    ...appleMusic,
    ...clearqueue,
    ...debug,
    ...mute,
    ...nextprevious,
    ...pauseall,
    ...playlist,
    ...playlists,
    ...playmode,
    ...playpause,
    ...preset,
    ...queue,
    ...seek,
    ...state,
    ...volume,
    ...zones,
  }

  #events = new HttpEventServer()
  #discovery = new SonosSystem()
  #presets

  constructor() {
    this.#presets = (() => {
      const res = {}

      for (const file of fs.readdirSync(
        path.resolve(import.meta.dirname, '../presets'),
        {
          withFileTypes: true,
        }
      )) {
        if (
          file.isFile() &&
          !file.name.startsWith('_') &&
          path.extname(file.name) === '.json'
        ) {
          res[file.name.replace(/\.json/i, '')] = JSON.parse(
            fs.readFileSync(path.join(file.parentPath, file.name), 'utf8')
          )
        }
      }

      return res
    })()

    const invokeWebhook = (type, data) => {
      this.#events.sendEvent(JSON.stringify({ type, data }), data.uuid)
    }

    this.#discovery.on('transport-state', (player) => {
      invokeWebhook('transport-state', player)
    })

    this.#discovery.on('topology-change', (topology) => {
      invokeWebhook('topology-change', topology)
    })

    this.#discovery.on('volume-change', (volumeChange) => {
      invokeWebhook('volume-change', volumeChange)
    })

    this.#discovery.on('mute-change', (muteChange) => {
      invokeWebhook('mute-change', muteChange)
    })
  }

  #parseParams(...params) {
    let playerId
    try {
      playerId = decodeURIComponent(params[0])
    } catch {
      throw new Error(`Unable to parse supplied URI component (${params[0]})`)
    }

    const player = this.#discovery.getPlayer(playerId)

    if (player) {
      return [
        player,
        {
          action: (params[1] || '').toLowerCase(),
          values: params.splice(2),
        },
      ]
    }

    return [
      this.#discovery.getAnyPlayer(),
      {
        action: (params[0] || '').toLowerCase(),
        values: params.splice(1),
      },
    ]
  }

  async requestHandler(req, res) {
    if (req.url === '/events') {
      return this.#events.addClient(res)
    }

    if (this.#discovery.zones.length === 0) {
      throw new Error(
        "No system has yet been discovered. Please see https://github.com/jishi/node-sonos-http-api/issues/77 if it doesn't resolve itself in a few seconds."
      )
    }

    const [player, { action, values }] = this.#parseParams(
      ...req.url.substring(1).split('/')
    )

    if (action === 'events') {
      return this.#events.addClient(
        res,
        player.uuid,
        JSON.stringify({ type: 'transport-state', data: player })
      )
    }

    if (!this.#actions[action]) {
      throw new Error(`action '${action}' not found`)
    }

    const start = Date.now()

    let response = await this.#actions[action](player, values, {
      presets: this.#presets,
    })

    if (!response || response.constructor.name === 'IncomingMessage') {
      response = { status: 'success' }
    } else if (
      Array.isArray(response) &&
      response.length > 0 &&
      response[0].constructor.name === 'IncomingMessage'
    ) {
      response = { status: 'success' }
    }

    logger.info(action, values.join(' '), `${Date.now() - start}ms`)

    return [200, response]
  }
}
