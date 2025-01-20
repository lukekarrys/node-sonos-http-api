import { once } from 'events'
import http from 'http'
import logger from './sonos-discovery/lib/helpers/logger.js'
import SonosHttpAPI from './lib/sonos-http-api.js'

const api = new SonosHttpAPI()

await api.loadActions()

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
      try {
        const res = await api.requestHandler(req, res)
        if (res) {
          const [code, body] = res
          const json = JSON.stringify(body)
          res.statusCode = code
          res.setHeader('Content-Length', Buffer.byteLength(json))
          res.setHeader('Content-Type', 'application/json;charset=utf-8')
          res.write(Buffer.from(json))
          res.end()
        }
      } catch (error) {
        const message = error?.error || error?.message
        return [500, { status: 'error', error: message }]
      }

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
