import type { Request, Response, RequestHandler } from 'express'
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

const SWEEP_INTERVAL_MS = 1000 * 60 * 5 // 5 min

export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>()

  // Periodic sweep to prevent unbounded memory growth from unique keys.
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.expiresAt <= now) {
        buckets.delete(key)
      }
    }
  }, SWEEP_INTERVAL_MS)
  timer.unref()

  return (req, res, next) => {
    const now = Date.now()
    const key = options.key(req)
    const existing = buckets.get(key)

    if (!existing || existing.expiresAt <= now) {
      buckets.set(key, {
        count: 1,
        expiresAt: now + options.windowMs,
      })
      res.setHeader('X-RateLimit-Limit', options.maxRequests)
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1)
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + options.windowMs) / 1000))
      next()
      return
    }

    existing.count += 1
    const remaining = Math.max(0, options.maxRequests - existing.count)
    res.setHeader('X-RateLimit-Limit', options.maxRequests)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', Math.ceil(existing.expiresAt / 1000))

    if (existing.count > options.maxRequests) {
      const retryAfter = Math.ceil((existing.expiresAt - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      next(new ApiError(429, options.code, options.message))
      return
    }

    next()
  }
}
