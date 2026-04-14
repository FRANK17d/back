import type { Response } from 'express'

export function sendSuccess<T>(res: Response, payload: { datos?: T; mensaje?: string; statusCode?: number }) {
  const { datos, mensaje, statusCode = 200 } = payload

  res.status(statusCode).json({
    ok: true,
    ...(mensaje ? { mensaje } : {}),
    ...(typeof datos === 'undefined' ? {} : { datos }),
  })
}
