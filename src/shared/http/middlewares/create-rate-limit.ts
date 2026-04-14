import type { Request, RequestHandler } from 'express'
import { ApiError } from '../api-error.js'

type RateLimitOptions = {
  windowMs: number
  maxRequests: number
  key: (req: Request) => string
  code: string
  message: string
}

type Bucket = {
  count: number
  expiresAt: number
}

export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>()

  return (req, _res, next) => {
    const now = Date.now()
    const key = options.key(req)
    const existing = buckets.get(key)

    if (!existing || existing.expiresAt <= now) {
      buckets.set(key, {
        count: 1,
        expiresAt: now + options.windowMs,
      })
      next()
      return
    }

    existing.count += 1

    if (existing.count > options.maxRequests) {
      next(new ApiError(429, options.code, options.message))
      return
    }

    next()
  }
}
