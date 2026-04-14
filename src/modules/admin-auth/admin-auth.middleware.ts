import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../../shared/http/api-error.js'
import { obtenerSesionAdmin } from './admin-auth.service.js'

export async function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await obtenerSesionAdmin({
      accessToken: req.cookies[res.locals.adminAccessCookieName as string] as string | undefined,
      refreshToken: req.cookies[res.locals.adminRefreshCookieName as string] as string | undefined,
    })

    if (session.refrescada) {
      res.cookie(res.locals.adminAccessCookieName as string, session.accessToken, res.locals.adminAccessCookieOptions)
      if (session.refreshToken) {
        res.cookie(
          res.locals.adminRefreshCookieName as string,
          session.refreshToken,
          res.locals.adminRefreshCookieOptions,
        )
      }
    }

    req.adminSession = session
    next()
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, 'SESION_REQUERIDA', 'Debes iniciar sesión como administrador.'))
  }
}
