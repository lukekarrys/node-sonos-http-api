class HttpEventSource {
  #res
  #channel

  constructor(res, channel) {
    this.#res = res
    this.#channel = channel
  }

  write(data) {
    this.#res.write(`${data}\n\n`)
  }

  sendEvent = (event, eventChannel) => {
    if (this.channel && this.channel !== eventChannel) {
      return
    }
    this.res.write('data: ' + event + '\n\n')
  }
}

export default class HttpEventServer {
  #clients = new Map()

  #removeClient(client) {
    this.#clients = this.#clients.filter((value) => value !== client)
  }

  addClient(res, channel, data) {
    const client = new HttpEventSource(res, channel)

    res.on('close', () => this.#removeClient(client))
    res.setHeader('Content-Type', 'text/event-stream')

    client.write(data ? `data: ${data}` : `event: ping\ndata:`)

    this.#clients.push(client)
  }

  sendEvent(event, channel) {
    for (const client of this.#clients.values()) {
      client.write()
    }
    this.#clients.forEach((client) => client.sendEvent(event, channel))
  }
}
