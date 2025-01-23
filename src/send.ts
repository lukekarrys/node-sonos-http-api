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
  extra?: unknown,
) => json(res, code, Object.assign({ error: message }, extra))

export const invalidParam = (
  res: Response,
  param: string | undefined,
  expected: string[] | readonly string[],
) => jsonError(res, 400, `Invalid param: "${param}"`, { expected })

export const invalidBodyOrParams = (
  res: Response,
  req: Request,
  err: unknown,
) =>
  jsonError(res, 400, `Invalid body or params`, {
    body: req.body as unknown,
    params: req.params,
    error: err,
  })
