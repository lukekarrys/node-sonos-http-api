import { type Request, type Response } from 'polka'

export const json = (res: Response, code: number, obj: object) => {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(obj))
}

export const empty = (res: Response) => {
  res.statusCode = 204
  res.end()
}

export const jsonError = (
  res: Response,
  code: number,
  message: string,
  extra?: unknown
) => json(res, code, Object.assign({ error: message }, extra))

export const invalidParam = (
  res: Response,
  param: string | undefined,
  expected: string[] | readonly string[]
) => jsonError(res, 400, `Invalid param: "${param}"`, { expected })

export const sse = (req: Request, res: Response) => {
  const write = (data: string) =>
    void res.write(`${data.startsWith(':') ? data : `data: ${data}`}\n\n`)

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const hb = setInterval(() => write(':heartbeat'), 30 * 1000)

  req.on('close', () => {
    clearInterval(hb)
    res.end()
  })

  return write
}
