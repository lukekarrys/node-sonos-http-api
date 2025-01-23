import polka, { type Request, type Response, type NextHandler } from 'polka'
import { once } from 'node:events'
import { setTimeout } from 'node:timers/promises'
import cors from 'cors'
import { urlencoded } from '@polka/parse'
import { jsonError, json } from './send.ts'
import deviceApp, { type SonosDevice } from './device.ts'
import { Devices, manager } from './sonos.ts'

const logger = () => (req: Request, res: Response, next: NextHandler) => {
  if (req.url !== '/hc') {
    console.log(
      'REQ',
      req.method,
      req.url,
      JSON.stringify(req.params),
      JSON.stringify(req.body),
    )
  }
  return next()
}

const app = polka<Request & { device?: SonosDevice }>({
  onNoMatch: (_req, res) => jsonError(res, 404, 'Not found'),
  onError: (err, req, res) => {
    jsonError(
      res,
      500,
      'Internal server error',
      typeof err === 'string' ? {} : err,
    )
  },
})
  .use(cors(), urlencoded(), logger())
  .get('/hc', (_req, res) => void res.end('OK'))
  .get('/devices', (req, res) => json(res, 200, Devices.get()))
  .get('/devices/name', (req, res) =>
    json(
      res,
      200,
      Devices.get().map((d) => Devices.normalizeName(d.Name)),
    ),
  )
  .use('d', deviceApp)

await Promise.all([
  await manager
    .InitializeWithDiscovery(10)
    .then(() => setTimeout(1000))
    .then(() => manager.CancelSubscription()),
  once(app.listen(5005, '0.0.0.0').server, 'listening'),
])

console.log(
  'Devices:',
  JSON.stringify(Devices.get().map((d) => [d.Name, d.Host])),
)
console.log(app.server.address())
