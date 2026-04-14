import { ApiError } from '../../shared/http/api-error.js'
import { createInsforgeServerClient } from '../../infrastructure/insforge/client.js'
import {
  buildAdminUser,
  createAuditEntry,
  findEligibleAdminByAuthUserId,
  findEligibleAdminByEmail,
  touchLastLogin,
} from './admin-auth.repository.js'
import type { AdminSession, RequestMeta, ResetPasswordToken } from './admin-auth.types.js'

type AuthUserLike = {
  id: string
  email: string
}

function mapInsforgeAuthError(error: { statusCode?: number; message?: string; error?: string } | null | undefined) {
  if (!error) {
    return new ApiError(500, 'AUTH_ERROR', 'No se pudo completar la autenticación.')
  }

  if (error.statusCode === 401) {
    return new ApiError(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña inválidos.')
  }

  if (error.statusCode === 403) {
    return new ApiError(403, 'CORREO_NO_VERIFICADO', 'El correo administrativo aún no está verificado.')
  }

  if (error.statusCode === 400) {
    return new ApiError(400, error.error || 'SOLICITUD_INVALIDA', error.message || 'La solicitud es inválida.')
  }

  return new ApiError(500, error.error || 'AUTH_ERROR', error.message || 'No se pudo completar la autenticación.')
}

async function invalidateSession(accessToken?: string | null) {
  if (!accessToken) {
    return
  }

  const insforge = createInsforgeServerClient(accessToken)
  await insforge.auth.signOut()
}

async function auditAnonymousEvent(payload: {
  action: string
  email?: string
  reason?: string
  meta: RequestMeta
}) {
  await createAuditEntry(undefined, {
    userId: null,
    action: payload.action,
    newValues: {
      email: payload.email ?? null,
      reason: payload.reason ?? null,
    },
    meta: payload.meta,
  }).catch(() => undefined)
}

async function resolveEligibleAdminOrThrow(authUser: AuthUserLike, accessToken: string) {
  const admin = await findEligibleAdminByAuthUserId(authUser.id)

  if (!admin) {
    await invalidateSession(accessToken)
    throw new ApiError(403, 'ADMIN_NO_AUTORIZADO', 'Acceso denegado. Solo administradores activos.')
  }

  return admin
}

async function buildSessionFromRefresh(refreshToken: string) {
  const insforge = createInsforgeServerClient()
  const { data, error } = await insforge.auth.refreshSession({ refreshToken })

  if (error || !data?.accessToken || !data.user) {
    throw new ApiError(401, 'SESION_INVALIDA', 'No se pudo refrescar la sesión administrativa.')
  }

  const admin = await resolveEligibleAdminOrThrow(data.user, data.accessToken)

  return {
    usuario: buildAdminUser(admin),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? refreshToken,
    refrescada: true,
  } satisfies AdminSession
}

export async function iniciarSesionAdmin(input: {
  correo: string
  contrasena: string
  meta: RequestMeta
}) {
  const insforge = createInsforgeServerClient()
  const { data, error } = await insforge.auth.signInWithPassword({
    email: input.correo,
    password: input.contrasena,
  })

  if (error || !data?.accessToken || !data.user) {
    await auditAnonymousEvent({
      action: 'admin_login_failed',
      email: input.correo,
      reason: error?.error || error?.message || 'invalid_credentials',
      meta: input.meta,
    })
    throw mapInsforgeAuthError(error)
  }

  const admin = await resolveEligibleAdminOrThrow(data.user, data.accessToken).catch(async (error) => {
    await auditAnonymousEvent({
      action: 'admin_login_denied',
      email: input.correo,
      reason: 'not_admin_or_inactive',
      meta: input.meta,
    })
    throw error
  })
  const timestamp = new Date().toISOString()

  await Promise.allSettled([
    touchLastLogin(data.accessToken, admin.id, timestamp),
    createAuditEntry(data.accessToken, {
      userId: admin.id,
      action: 'admin_login',
      recordId: admin.id,
      newValues: { canal: 'web_admin' },
      meta: input.meta,
    }),
  ])

  return {
    usuario: buildAdminUser({ ...admin, last_login_at: timestamp }),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? null,
    refrescada: false,
  } satisfies AdminSession
}

export async function obtenerSesionAdmin(input: {
  accessToken?: string
  refreshToken?: string
}) {
  if (!input.accessToken && !input.refreshToken) {
    throw new ApiError(401, 'SESION_REQUERIDA', 'No hay una sesión administrativa activa.')
  }

  if (input.accessToken) {
    const insforge = createInsforgeServerClient(input.accessToken)
    const { data, error } = await insforge.auth.getCurrentUser()

    if (!error && data?.user) {
      const admin = await resolveEligibleAdminOrThrow(data.user, input.accessToken)

      return {
        usuario: buildAdminUser(admin),
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? null,
        refrescada: false,
      } satisfies AdminSession
    }
  }

  if (!input.refreshToken) {
    throw new ApiError(401, 'SESION_EXPIRADA', 'La sesión administrativa expiró.')
  }

  return buildSessionFromRefresh(input.refreshToken)
}

export async function refrescarSesionAdmin(input: {
  refreshToken?: string
  meta: RequestMeta
}) {
  if (!input.refreshToken) {
    throw new ApiError(401, 'REFRESH_TOKEN_REQUERIDO', 'No se encontró el refresh token administrativo.')
  }

  const session = await buildSessionFromRefresh(input.refreshToken)

  await createAuditEntry(session.accessToken, {
    userId: session.usuario.id,
    action: 'admin_session_refresh',
    recordId: session.usuario.id,
    newValues: { refrescada: true },
    meta: input.meta,
  }).catch(() => undefined)

  return session
}

export async function cerrarSesionAdmin(input: {
  accessToken?: string
  meta: RequestMeta
}) {
  if (!input.accessToken) {
    return
  }

  const admin = await obtenerSesionAdmin({ accessToken: input.accessToken }).catch(() => null)

  if (admin) {
    await createAuditEntry(input.accessToken, {
      userId: admin.usuario.id,
      action: 'admin_logout',
      recordId: admin.usuario.id,
      meta: input.meta,
    }).catch(() => undefined)
  }

  await invalidateSession(input.accessToken)
}

export async function solicitarRestablecimientoAdmin(input: {
  correo: string
  meta: RequestMeta
}) {
  const correo = input.correo
  const admin = await findEligibleAdminByEmail(correo)

  if (!admin) {
    await auditAnonymousEvent({
      action: 'admin_password_reset_requested',
      email: correo,
      reason: 'ignored_non_admin_or_missing',
      meta: input.meta,
    })
    return
  }

  const insforge = createInsforgeServerClient()
  const { error } = await insforge.auth.sendResetPasswordEmail({ email: correo })

  if (error) {
    throw mapInsforgeAuthError(error)
  }

  await auditAnonymousEvent({
    action: 'admin_password_reset_requested',
    email: correo,
    reason: 'sent',
    meta: input.meta,
  })
}

export async function verificarCodigoRestablecimientoAdmin(input: {
  correo: string
  codigo: string
  meta: RequestMeta
}) {
  const admin = await findEligibleAdminByEmail(input.correo)

  if (!admin) {
    await auditAnonymousEvent({
      action: 'admin_password_reset_verification_failed',
      email: input.correo,
      reason: 'invalid_email_or_code',
      meta: input.meta,
    })
    throw new ApiError(400, 'CODIGO_INVALIDO', 'El código de verificación no es válido o expiró.')
  }

  const insforge = createInsforgeServerClient()
  const { data, error } = await insforge.auth.exchangeResetPasswordToken({
    email: input.correo,
    code: input.codigo,
  })

  if (error || !data?.token || !data.expiresAt) {
    await auditAnonymousEvent({
      action: 'admin_password_reset_verification_failed',
      email: input.correo,
      reason: error?.error || error?.message || 'invalid_code',
      meta: input.meta,
    })
    throw mapInsforgeAuthError(error)
  }

  await auditAnonymousEvent({
    action: 'admin_password_reset_verified',
    email: input.correo,
    reason: 'code_accepted',
    meta: input.meta,
  })

  return {
    token: data.token,
    expiraEn: data.expiresAt,
  } satisfies ResetPasswordToken
}

export async function restablecerContrasenaAdmin(input: {
  token: string
  nuevaContrasena: string
  meta: RequestMeta
}) {
  const insforge = createInsforgeServerClient()
  const { error } = await insforge.auth.resetPassword({
    otp: input.token,
    newPassword: input.nuevaContrasena,
  })

  if (error) {
    await auditAnonymousEvent({
      action: 'admin_password_reset_failed',
      reason: error.error || error.message || 'invalid_reset_token',
      meta: input.meta,
    })
    throw mapInsforgeAuthError(error)
  }

  await auditAnonymousEvent({
    action: 'admin_password_reset_completed',
    reason: 'password_updated',
    meta: input.meta,
  })
}
