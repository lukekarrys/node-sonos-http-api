class HttpEventSource {
  #res
  #channel

  constructor(res, channel) {
    this.#res = res
    this.#channel = channel
  }

  get channel() {
    return this.#channel
  }

  data(data) {
    this.#res.write(`data: ${data}\n\n`)
  }

  ping() {
    this.#res.write('event: ping\ndata:\n\n')
  }
}

export default class HttpEventServer {
  #clients = new Set()

  addClient(res, channel, data) {
    const client = new HttpEventSource(res, channel)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.on('close', () => this.#clients.delete(client))

    if (data) {
      client.data(data)
    } else {
      client.ping()
    }

    this.#clients.add(client)
  }

  sendEvent(event, channel) {
    for (const client of this.#clients) {
      if (!channel || client.channel === channel) {
        client.data(event)
      }
    }
  }
}
