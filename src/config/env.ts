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

function getBooleanEnv(name: string, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase()

  if (!value) return fallback

  return value === '1' || value === 'true' || value === 'yes'
}

const nodeEnv = (process.env.NODE_ENV?.trim() as NodeEnv | undefined) ?? 'development'

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: getNumberEnv('PORT', 4000),
  appOrigin: process.env.APP_ORIGIN?.trim() || 'http://localhost:3000',
  insforgeUrl: getRequiredEnv('INSFORGE_URL'),
  insforgeAnonKey: getRequiredEnv('INSFORGE_ANON_KEY'),
  insforgeApiKey: process.env.INSFORGE_API_KEY?.trim() || '',
  publicApiUrl: process.env.PUBLIC_API_URL?.trim().replace(/\/+$/, '') || '',
  paymentSuccessUrl: process.env.PAYMENT_SUCCESS_URL?.trim() || '',
  paymentFailureUrl: process.env.PAYMENT_FAILURE_URL?.trim() || '',
  paymentPendingUrl: process.env.PAYMENT_PENDING_URL?.trim() || '',
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || '',
  mercadoPagoUseSandbox: getBooleanEnv('MERCADOPAGO_USE_SANDBOX'),
  mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || '',
  // Model Gateway de InsForge (clave de OpenRouter del dashboard). Opcional:
  // si falta, las rutas de IA devuelven un error claro en vez de romper el boot.
  openrouterApiKey: process.env.OPENROUTER_API_KEY?.trim() || '',
} as const
