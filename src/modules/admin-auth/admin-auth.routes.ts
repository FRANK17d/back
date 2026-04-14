import { Router } from 'express'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { createRateLimit } from '../../shared/http/middlewares/create-rate-limit.js'
import { validateBody } from '../../shared/validation/validate.js'
import {
  iniciarSesionAdminController,
  obtenerSesionAdminController,
  refrescarSesionAdminController,
  cerrarSesionAdminController,
  solicitarRestablecimientoAdminController,
  verificarCodigoRestablecimientoAdminController,
  restablecerContrasenaAdminController,
} from './admin-auth.controller.js'
import {
  iniciarSesionAdminSchema,
  solicitarRestablecimientoSchema,
  verificarCodigoRestablecimientoSchema,
  restablecerContrasenaSchema,
} from './admin-auth.schemas.js'

export const adminAuthRouter = Router()

const adminLoginRateLimit = createRateLimit({
  windowMs: 1000 * 60 * 10,
  maxRequests: 5,
  key: (req) => `${req.ip}:${String(req.body?.correo ?? '').trim().toLowerCase()}`,
  code: 'ADMIN_LOGIN_RATE_LIMITED',
  message: 'Demasiados intentos de inicio de sesión. Espera unos minutos e inténtalo de nuevo.',
})

const adminPasswordResetRateLimit = createRateLimit({
  windowMs: 1000 * 60 * 10,
  maxRequests: 5,
  key: (req) => `${req.ip}:${String(req.body?.correo ?? '').trim().toLowerCase()}`,
  code: 'ADMIN_PASSWORD_RESET_RATE_LIMITED',
  message: 'Demasiadas solicitudes de restablecimiento. Espera unos minutos e inténtalo de nuevo.',
})

adminAuthRouter.post('/sessions', validateBody(iniciarSesionAdminSchema), adminLoginRateLimit, asyncHandler(iniciarSesionAdminController))
adminAuthRouter.get('/sessions/current', asyncHandler(obtenerSesionAdminController))
adminAuthRouter.post('/sessions/refresh', asyncHandler(refrescarSesionAdminController))
adminAuthRouter.delete('/sessions/current', asyncHandler(cerrarSesionAdminController))
adminAuthRouter.post(
  '/password-reset-requests',
  validateBody(solicitarRestablecimientoSchema),
  adminPasswordResetRateLimit,
  asyncHandler(solicitarRestablecimientoAdminController),
)
adminAuthRouter.post(
  '/password-reset-verifications',
  validateBody(verificarCodigoRestablecimientoSchema),
  adminPasswordResetRateLimit,
  asyncHandler(verificarCodigoRestablecimientoAdminController),
)
adminAuthRouter.post(
  '/password-resets',
  validateBody(restablecerContrasenaSchema),
  createRateLimit({
    windowMs: 1000 * 60 * 10,
    maxRequests: 5,
    key: (req) => `${req.ip}:${String(req.body?.token ?? '').trim()}`,
    code: 'ADMIN_PASSWORD_UPDATE_RATE_LIMITED',
    message: 'Demasiados intentos de actualización de contraseña. Espera unos minutos e inténtalo de nuevo.',
  }),
  asyncHandler(restablecerContrasenaAdminController),
)
