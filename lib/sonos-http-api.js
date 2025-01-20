const fs = require('fs')
const path = require('path')
const logger = require('../sonos-discovery/lib/helpers/logger')
const HttpEventServer = require('./http-event-server')

module.exports = class HttpAPI {
  #actions = {}
  #events = new HttpEventServer()

  #discovery
  #settings

  constructor(discovery, settings) {
    this.#discovery = discovery
    this.#settings = settings
    this.#initEvents()
    this.#loadActions()
  }

  get discovery() {
    return this.#discovery
  }

  registerAction(action, handler) {
    this.#actions[action] = handler
  }

  async requestHandler(req, res) {
    if (req.url === '/events') {
      this.#events.addClient(res)
      return
    }

    if (this.#discovery.zones.length === 0) {
      const msg =
        "No system has yet been discovered. Please see https://github.com/jishi/node-sonos-http-api/issues/77 if it doesn't resolve itself in a few seconds."
      logger.error(msg)
      sendResponse(500, { status: 'error', error: msg })
      return
    }

    const params = req.url.substring(1).split('/')

    // parse decode player name considering decode errors
    let player
    try {
      player = this.#discovery.getPlayer(decodeURIComponent(params[0]))
    } catch (error) {
      logger.error(
        `Unable to parse supplied URI component (${params[0]})`,
        error
      )
      return sendResponse(500, {
        status: 'error',
        error: error.message,
        stack: error.stack,
      })
    }

    const opt = {}

    if (player) {
      opt.action = (params[1] || '').toLowerCase()
      opt.values = params.splice(2)
    } else {
      player = this.#discovery.getAnyPlayer()
      opt.action = (params[0] || '').toLowerCase()
      opt.values = params.splice(1)
    }

    if (opt.action === 'events') {
      this.#events.addClient(
        res,
        player.uuid,
        JSON.stringify({ type: 'transport-state', data: player })
      )
      return
    }

    function sendResponse(code, body) {
      var jsonResponse = JSON.stringify(body)
      res.statusCode = code
      res.setHeader('Content-Length', Buffer.byteLength(jsonResponse))
      res.setHeader('Content-Type', 'application/json;charset=utf-8')
      res.write(Buffer.from(jsonResponse))
      res.end()
    }

    opt.player = player
    const start = Date.now()

    try {
      let response = await this.#handleAction(opt)
      if (!response || response.constructor.name === 'IncomingMessage') {
        response = { status: 'success' }
      } else if (
        Array.isArray(response) &&
        response.length > 0 &&
        response[0].constructor.name === 'IncomingMessage'
      ) {
        response = { status: 'success' }
      }
      logger.info(opt.action, opt.values.join(' '), `${Date.now() - start}ms`)
      sendResponse(200, response)
    } catch (error) {
      const message = error?.error || error?.message
      logger.error(message, `${Date.now() - start}ms`)
      sendResponse(500, {
        status: 'error',
        error: message,
      })
    }
  }

  #loadActions() {
    //load modularized actions
    for (const file of fs.readdirSync(path.join(__dirname, './actions'), {
      withFileTypes: true,
    })) {
      if (
        !file.isDirectory() &&
        !file.name.startsWith('.') &&
        file.name.endsWith('.js')
      ) {
        require(path.join(file.parentPath, file.name))(this)
      }
    }
  }

  async #handleAction(options) {
    var player = options.player

    if (!this.#actions[options.action]) {
      throw new Error("action '" + options.action + "' not found")
    }

    return this.#actions[options.action](player, options.values, this.#settings)
  }

  #initEvents() {
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
}
