import polka from 'polka'
import { once } from 'node:events'
import cors from 'cors'
import { urlencoded } from '@polka/parse'
import { jsonError, invalidParam } from './send.ts'
import { managerRoutes, deviceRoutes } from './routes.ts'
import { manager, findDeviceByName } from './sonos.ts'

const app = polka({
  onNoMatch: (_req, res) => jsonError(res, 404, 'Not found'),
  onError: (err, req, res) => {
    console.error(err)
    jsonError(
      res,
      500,
      'Internal server error',
      typeof err === 'string' ? {} : err
    )
  },
})
  .use(cors(), urlencoded())
  .get('/hc', (_req, res) => void res.end('OK'))

for (const [method, path, handler] of managerRoutes) {
  app.add(method, path, (req, res) => handler(manager, req, res))
}

for (const [method, path, handler] of deviceRoutes) {
  const key = 'deviceParam'
  app.add(method, `/d/:${key}${path!}`, (req, res) => {
    const param = req.params[key]
    const [device, devices] = findDeviceByName(param)
    if (!device) {
      return invalidParam(res, param, devices)
    }
    return handler(device, req, res)
  })
}

await Promise.all([
  await manager.InitializeWithDiscovery(10),
  once(app.listen(5005, '0.0.0.0').server, 'listening'),
])

console.log('Devices:', JSON.stringify(manager.Devices.map((d) => d.Name)))
console.log(app.server.address())
