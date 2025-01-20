let services = {}
const logger = require('./helpers/logger')

const requireServices = [
  require('./services/deezer.js'),
  require('./services/soundcloud.js'),
  require('./services/spotify.js'),
].forEach((register) => {
  register(services)
})

function getServiceId(uri) {
  const matches = /sid=(\d+)/.exec(uri)
  if (matches) {
    return matches[1]
  }
}

function tryGetHighResArt(uri) {
  if (uri.startsWith('http')) return Promise.resolve(uri)

  let serviceId = getServiceId(uri)

  if (!services[serviceId]) {
    logger.debug('No such service', uri)
    return Promise.reject('No such service')
  }

  let service = services[serviceId]

  return service.tryGetHighResArt(uri)
}

module.exports = {
  tryGetHighResArt,
}
