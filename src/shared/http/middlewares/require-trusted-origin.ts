import type { RequestHandler } from 'express'
import { env } from '../../../config/env.js'
import { ApiError } from '../api-error.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function toOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next()
    return
  }

  const expectedOrigin = toOrigin(env.appOrigin)
  const requestOrigin = req.get('origin')
  const requestReferer = req.get('referer')

  if (!expectedOrigin) {
    next()
    return
  }

  // Reject state-changing requests that arrive without Origin or Referer.
  // Legitimate browser requests always send at least one of these headers.
  // Allowing requests without them would let non-browser clients bypass CSRF.
  if (!requestOrigin && !requestReferer) {
    next(new ApiError(403, 'ORIGIN_REQUIRED', 'La solicitud requiere un encabezado Origin o Referer.'))
    return
  }

  const actualOrigin = requestOrigin ? toOrigin(requestOrigin) : requestReferer ? toOrigin(requestReferer) : null

  if (actualOrigin && actualOrigin === expectedOrigin) {
    next()
    return
  }

  next(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'La solicitud fue bloqueada por la política de origen.'))
}
