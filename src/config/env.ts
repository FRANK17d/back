type NodeEnv = 'development' | 'test' | 'production'

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`)
  }

  return value
}

function getNumberEnv(name: string, fallback: number) {
  const value = process.env[name]?.trim()

  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error(`La variable ${name} debe ser numérica.`)
  }

  return parsed
}

const nodeEnv = (process.env.NODE_ENV?.trim() as NodeEnv | undefined) ?? 'development'

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: getNumberEnv('PORT', 4000),
  appOrigin: process.env.APP_ORIGIN?.trim() || 'http://localhost:3000',
  insforgeUrl: getRequiredEnv('INSFORGE_URL'),
  insforgeAnonKey: getRequiredEnv('INSFORGE_ANON_KEY'),
  adminAccessCookieName:
    process.env.ADMIN_ACCESS_COOKIE_NAME?.trim() || 'maestroya_admin_access_token',
  adminRefreshCookieName:
    process.env.ADMIN_REFRESH_COOKIE_NAME?.trim() || 'maestroya_admin_refresh_token',
  adminAccessCookieMaxAgeMs: getNumberEnv('ADMIN_ACCESS_COOKIE_MAX_AGE_MS', 1000 * 60 * 15),
  adminRefreshCookieMaxAgeMs: getNumberEnv('ADMIN_REFRESH_COOKIE_MAX_AGE_MS', 1000 * 60 * 60 * 12),
} as const
