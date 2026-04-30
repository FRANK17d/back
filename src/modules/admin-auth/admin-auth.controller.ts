import type { CookieOptions, Request, Response } from 'express'
import { sendSuccess } from '../../shared/http/response.js'
import {
  cerrarSesionAdmin,
  iniciarSesionAdmin,
  obtenerSesionAdmin,
  refrescarSesionAdmin,
  solicitarRestablecimientoAdmin,
  restablecerContrasenaAdmin,
  verificarCodigoRestablecimientoAdmin,
} from './admin-auth.service.js'
import type { AdminSession, RequestMeta } from './admin-auth.types.js'

function getRequestMeta(req: Request): RequestMeta {
  const forwardedFor = req.headers['x-forwarded-for']
  const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]

  return {
    ipAddress: firstForwarded?.trim() || req.ip || null,
    userAgent: req.get('user-agent')?.trim() || null,
  }
}

export function setAdminAuthCookies(res: Response, session: Pick<AdminSession, 'accessToken' | 'refreshToken'>) {
  const accessOptions = res.locals.adminAccessCookieOptions as CookieOptions
  const refreshOptions = res.locals.adminRefreshCookieOptions as CookieOptions
  const accessCookieName = res.locals.adminAccessCookieName as string
  const refreshCookieName = res.locals.adminRefreshCookieName as string

  res.cookie(accessCookieName, session.accessToken, accessOptions)

  if (session.refreshToken) {
    res.cookie(refreshCookieName, session.refreshToken, refreshOptions)
  }
}

function clearAdminAuthCookies(res: Response) {
  const accessCookieName = res.locals.adminAccessCookieName as string
  const refreshCookieName = res.locals.adminRefreshCookieName as string
  const accessOptions = res.locals.adminAccessCookieOptions as CookieOptions
  const refreshOptions = res.locals.adminRefreshCookieOptions as CookieOptions

  // clearCookie only works when path/domain/secure/sameSite match the original set.
  // Omitting them causes the browser to keep the cookie (especially in production
  // where secure=true and sameSite='strict').
  const { maxAge: _a, ...accessClearOpts } = accessOptions
  const { maxAge: _r, ...refreshClearOpts } = refreshOptions

  res.clearCookie(accessCookieName, accessClearOpts)
  res.clearCookie(refreshCookieName, refreshClearOpts)
}

export async function iniciarSesionAdminController(req: Request, res: Response) {
  const session = await iniciarSesionAdmin({
    correo: req.body.correo,
    contrasena: req.body.contrasena,
    meta: getRequestMeta(req),
  })

  setAdminAuthCookies(res, session)

  sendSuccess(res, {
    mensaje: 'Sesión administrativa iniciada correctamente.',
    datos: {
      usuario: session.usuario,
      autenticado: true,
    },
  })
}

export async function obtenerSesionAdminController(req: Request, res: Response) {
  const session = await obtenerSesionAdmin({
    accessToken: req.cookies[res.locals.adminAccessCookieName as string] as string | undefined,
    refreshToken: req.cookies[res.locals.adminRefreshCookieName as string] as string | undefined,
  })

  if (session.refrescada) {
    setAdminAuthCookies(res, session)
  }

  sendSuccess(res, {
    datos: {
      usuario: session.usuario,
      autenticado: true,
      refrescada: session.refrescada,
    },
  })
}

export async function refrescarSesionAdminController(req: Request, res: Response) {
  const session = await refrescarSesionAdmin({
    refreshToken: req.cookies[res.locals.adminRefreshCookieName as string] as string | undefined,
    meta: getRequestMeta(req),
  })

  setAdminAuthCookies(res, session)

  sendSuccess(res, {
    mensaje: 'Sesión administrativa refrescada.',
    datos: {
      usuario: session.usuario,
      autenticado: true,
      refrescada: true,
    },
  })
}

export async function cerrarSesionAdminController(req: Request, res: Response) {
  await cerrarSesionAdmin({
    accessToken: req.cookies[res.locals.adminAccessCookieName as string] as string | undefined,
    refreshToken: req.cookies[res.locals.adminRefreshCookieName as string] as string | undefined,
    meta: getRequestMeta(req),
  })

  clearAdminAuthCookies(res)

  sendSuccess(res, {
    mensaje: 'Sesión administrativa cerrada.',
  })
}

export async function solicitarRestablecimientoAdminController(req: Request, res: Response) {
  await solicitarRestablecimientoAdmin({
    correo: req.body.correo,
    meta: getRequestMeta(req),
  })

  sendSuccess(res, {
    mensaje: 'Si la cuenta administrativa existe, se envió un código de restablecimiento.',
  })
}

export async function verificarCodigoRestablecimientoAdminController(req: Request, res: Response) {
  const token = await verificarCodigoRestablecimientoAdmin({
    correo: req.body.correo,
    codigo: req.body.codigo,
    meta: getRequestMeta(req),
  })

  sendSuccess(res, {
    mensaje: 'Código de restablecimiento validado.',
    datos: token,
  })
}

export async function restablecerContrasenaAdminController(req: Request, res: Response) {
  await restablecerContrasenaAdmin({
    token: req.body.token,
    nuevaContrasena: req.body.nuevaContrasena,
    meta: getRequestMeta(req),
  })

  sendSuccess(res, {
    mensaje: 'La contraseña administrativa fue actualizada.',
  })
}
