import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { adminAuthRouter } from './modules/admin-auth/admin-auth.routes.js'
import { errorHandler } from './shared/http/error-handler.js'
import { requireTrustedOrigin } from './shared/http/middlewares/require-trusted-origin.js'
import { notFoundHandler } from './shared/http/not-found-handler.js'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: env.appOrigin,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.use((req, res, next) => {
    res.locals.adminAccessCookieName = env.adminAccessCookieName
    res.locals.adminRefreshCookieName = env.adminRefreshCookieName
    res.locals.adminAccessCookieOptions = {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: env.adminAccessCookieMaxAgeMs,
    }
    res.locals.adminRefreshCookieOptions = {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: env.adminRefreshCookieMaxAgeMs,
    }
    next()
  })

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
        servicio: 'backend-maestroya',
        estado: 'ok',
      },
    })
  })

  app.use('/api/admin', adminAuthRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
