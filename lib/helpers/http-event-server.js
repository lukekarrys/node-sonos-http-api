function HttpEventServer() {
  let clients = []

  const removeClient = (client) =>
    (clients = clients.filter((value) => value !== client))

  this.addClient = (res, channel, data) =>
    clients.push(new HttpEventSource(res, removeClient, channel, data))

  this.sendEvent = (event, channel) =>
    clients.forEach((client) => client.sendEvent(event, channel))
}

function HttpEventSource(res, done, channel, initialData) {
  this.sendEvent = (event, eventChannel) => {
    if (channel && channel !== eventChannel) {
      return
    }
    res.write('data: ' + event + '\n\n')
  }
  res.on('close', () => done(this))

  res.setHeader('Content-Type', 'text/event-stream')

  if (initialData) {
    res.write('data: ' + initialData + '\n\n')
  } else {
    res.write('event: ping\ndata:\n\n')
  }
}

module.exports = HttpEventServer
