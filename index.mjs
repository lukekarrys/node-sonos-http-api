import { once } from 'events'
import http from 'http'
import SonosSystem from './sonos-discovery/lib/SonosSystem.js'
import logger from './sonos-discovery/lib/helpers/logger.js'
import SonosHttpAPI from './lib/sonos-http-api.js'
import path from 'path'
import fs from 'fs'

process.on('unhandledRejection', (err) => logger.error(err))
process.on('uncaughtException', (err) => logger.error(err))

const settings = {
  port: 5005,
  ip: '0.0.0.0',
  presets: (() => {
    const res = {}

    for (const file of fs.readdirSync(path.resolve(__dirname, 'presets'), {
      withFileTypes: true,
    })) {
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
  })(),
}

const api = new SonosHttpAPI(new SonosSystem(), settings)

const server = http
  .createServer()
  .on('request', async (req, res) => {
    // Enable CORS requests
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (req.headers['access-control-request-headers']) {
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers']
      )
    }

    if (req.method === 'OPTIONS') {
      res.end()
      return
    }

    if (req.method === 'POST') {
      await api.requestHandler(req, res)
      return
    }

    res.statusCode = 405
    res.end('')
  })
  .on('error', (err) => {
    logger.error(err)
    process.exit(1)
  })
  .listen(5005, '0.0.0.0')

await once(server, 'listening')

logger.info(
  `Server running at ${server.address().address}:${server.address().port}`
)
