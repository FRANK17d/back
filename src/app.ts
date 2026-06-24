import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler } from './shared/http/error-handler.js'
import { requireTrustedOrigin } from './shared/http/middlewares/require-trusted-origin.js'
import { notFoundHandler } from './shared/http/not-found-handler.js'
import { notificationsRouter } from './modules/notifications/router.js'
import { aiRouter } from './modules/ai/router.js'
import { paymentsRouter } from './modules/payments/router.js'

export function createApp() {
  const app = express()

  // Trust the first proxy (e.g. nginx / cloud LB) so req.ip is accurate
  // for rate limiting and audit logging.
  app.set('trust proxy', 1)

  app.use(
    cors({
      origin: env.appOrigin,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.use('/api/admin', requireTrustedOrigin)
  app.use('/api/admin', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    next()
  })

  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      datos: {
        servicio: 'backend-toke',
        estado: 'ok',
      },
    })
  })

  app.use('/api/notifications', notificationsRouter)
  app.use('/api/ai', aiRouter)
  app.use('/api/payments', paymentsRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
