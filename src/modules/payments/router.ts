import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { env } from '../../config/env.js'
import {
  createInsforgeAdminClient,
  createInsforgeServerClient,
} from '../../infrastructure/insforge/client.js'
import { ApiError } from '../../shared/http/api-error.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { validateBody } from '../../shared/validation/validate.js'

type DbError = { message?: string; code?: string; details?: unknown }
type DbResponse = { data?: unknown; error?: DbError | null }

type AuthenticatedTechnician = {
  id: string
  email: string
}

type CreditPackageRow = {
  id: number
  name: string
  credits: number
  price_pen: number | string
}

type SubscriptionPlanRow = {
  id: number
  name: string
  duration_days: number
  price_pen: number | string
  included_credits: number
}

type PaymentOrderRow = {
  id: string
  kind: 'credits' | 'subscription'
}

const mercadoPagoApiBaseUrl = 'https://api.mercadopago.com'

const createCreditCheckoutSchema = z.object({
  packageId: z.coerce.number().int().positive(),
})

const createTokeProCheckoutSchema = z.object({
  planId: z.coerce.number().int().positive(),
})

export const paymentsRouter = Router()

paymentsRouter.post(
  '/credits/checkout',
  validateBody(createCreditCheckoutSchema),
  asyncHandler(async (req, res) => {
    assertPaymentsConfigured()

    const technician = await getAuthenticatedTechnician(req)
    const { packageId } = req.body as z.infer<typeof createCreditCheckoutSchema>
    const admin = createInsforgeAdminClient()
    const creditPackage = await getActiveCreditPackage(admin, packageId)
    const orderId = randomUUID()
    const amount = toAmount(creditPackage.price_pen)

    await insertPaymentOrder(admin, {
      id: orderId,
      technician_id: technician.id,
      kind: 'credits',
      credit_package_id: creditPackage.id,
      amount_pen: amount,
      credits: creditPackage.credits,
    })

    const preference = await mercadoPagoRequest<{
      id?: string
      init_point?: string
      sandbox_init_point?: string
    }>('/checkout/preferences', {
      method: 'POST',
      body: {
        items: [
          {
            id: `credits-${creditPackage.id}`,
            title: creditPackage.name || `${creditPackage.credits} creditos Toke+`,
            description: `${creditPackage.credits} creditos para postular a pedidos`,
            quantity: 1,
            currency_id: 'PEN',
            unit_price: amount,
          },
        ],
        ...(technician.email ? { payer: { email: technician.email } } : {}),
        external_reference: orderId,
        metadata: {
          order_id: orderId,
          kind: 'credits',
          technician_id: technician.id,
          credit_package_id: creditPackage.id,
        },
        notification_url: getNotificationUrl(),
        ...getPreferenceReturnUrls(orderId),
      },
    })

    const checkoutUrl = getCheckoutUrl(preference)
    await updatePaymentOrder(admin, orderId, {
      provider_preference_id: preference.id ?? null,
      checkout_url: checkoutUrl,
      provider_payload: preference,
    })

    res.status(201).json({
      ok: true,
      datos: {
        orderId,
        provider: 'mercadopago',
        checkoutUrl,
      },
    })
  }),
)

paymentsRouter.get(
  '/mercadopago/return',
  asyncHandler(async (req, res) => {
    const status = getString(req.query.status) || 'success'
    const orderId = getString(req.query.order_id)
    const target = getReturnUrl(getReturnBaseUrl(status), orderId, status)

    if (!target) {
      res.status(200).send('Pago procesado. Puedes volver a Toke+.')
      return
    }

    res.redirect(302, target)
  }),
)

paymentsRouter.post(
  '/tokepro/checkout',
  validateBody(createTokeProCheckoutSchema),
  asyncHandler(async (req, res) => {
    assertPaymentsConfigured()

    const technician = await getAuthenticatedTechnician(req)
    const { planId } = req.body as z.infer<typeof createTokeProCheckoutSchema>
    const admin = createInsforgeAdminClient()
    const plan = await getActiveSubscriptionPlan(admin, planId)
    const orderId = randomUUID()
    const amount = toAmount(plan.price_pen)

    if (!technician.email) {
      throw new ApiError(400, 'EMAIL_REQUERIDO', 'El tecnico necesita un email para suscribirse.')
    }

    await insertPaymentOrder(admin, {
      id: orderId,
      technician_id: technician.id,
      kind: 'subscription',
      subscription_plan_id: plan.id,
      amount_pen: amount,
      credits: plan.included_credits,
    })

    const preapproval = await mercadoPagoRequest<{
      id?: string
      init_point?: string
      sandbox_init_point?: string
    }>('/preapproval', {
      method: 'POST',
      body: {
        reason: `TokePro - ${plan.name}`,
        external_reference: orderId,
        payer_email: technician.email,
        back_url: getBackendReturnUrl(orderId, 'success'),
        notification_url: getNotificationUrl(),
        status: 'pending',
        auto_recurring: {
          frequency: plan.duration_days,
          frequency_type: 'days',
          transaction_amount: amount,
          currency_id: 'PEN',
        },
      },
    })

    const checkoutUrl = getCheckoutUrl(preapproval)
    await updatePaymentOrder(admin, orderId, {
      provider_preapproval_id: preapproval.id ?? null,
      checkout_url: checkoutUrl,
      provider_payload: preapproval,
    })

    res.status(201).json({
      ok: true,
      datos: {
        orderId,
        provider: 'mercadopago',
        checkoutUrl,
      },
    })
  }),
)

paymentsRouter.post(
  '/mercadopago/webhook',
  asyncHandler(async (req, res) => {
    verifyMercadoPagoSignature(req)

    const eventType = getWebhookEventType(req)
    const dataId = getWebhookDataId(req)

    if (!dataId) {
      res.status(200).json({ ok: true })
      return
    }

    if (isMercadoPagoTestNotification(req, dataId)) {
      res.status(200).json({ ok: true, test: true })
      return
    }

    if (eventType === 'payment') {
      await handlePaymentWebhook(dataId)
    } else if (eventType === 'subscription_preapproval' || eventType === 'preapproval') {
      await handlePreapprovalWebhook(dataId)
    } else if (eventType === 'subscription_authorized_payment') {
      console.warn('[payments/webhook] subscription_authorized_payment pending implementation', dataId)
    }

    res.status(200).json({ ok: true })
  }),
)

function assertPaymentsConfigured() {
  if (!env.mercadoPagoAccessToken) {
    throw new ApiError(503, 'MERCADOPAGO_NO_CONFIGURADO', 'Falta MERCADOPAGO_ACCESS_TOKEN.')
  }

  if (!env.publicApiUrl) {
    throw new ApiError(503, 'WEBHOOK_NO_CONFIGURADO', 'Falta PUBLIC_API_URL para webhooks.')
  }

  if (!env.insforgeApiKey) {
    throw new ApiError(503, 'INSFORGE_ADMIN_NO_CONFIGURADO', 'Falta INSFORGE_API_KEY.')
  }
}

async function getAuthenticatedTechnician(req: Request): Promise<AuthenticatedTechnician> {
  const token = getBearerToken(req)
  const client = createInsforgeServerClient(token)
  const authResult = (await (client as any).auth.getCurrentUser()) as DbResponse
  const authData = authResult.data as { id?: string; email?: string; user?: { id?: string; email?: string } } | null
  const userId = authData?.user?.id ?? authData?.id
  const authEmail = authData?.user?.email ?? authData?.email ?? ''

  if (authResult.error || !userId) {
    throw new ApiError(401, 'NO_AUTENTICADO', 'Inicia sesion para continuar.')
  }

  const admin = createInsforgeAdminClient()
  const profile = await selectFirst<{ id: string; role?: string; email?: string }>(
    await (admin as any).database.from('profiles').select('id, role, email').eq('id', userId),
  )

  if (!profile || profile.role !== 'technician') {
    throw new ApiError(403, 'SOLO_TECNICOS', 'Solo una cuenta tecnica puede comprar creditos o TokePro.')
  }

  const technicianProfile = await selectFirst<{ id: string }>(
    await (admin as any).database.from('technician_profiles').select('id').eq('id', userId),
  )

  if (!technicianProfile) {
    throw new ApiError(403, 'TECNICO_INCOMPLETO', 'Completa tu perfil tecnico antes de comprar.')
  }

  return {
    id: userId,
    email: authEmail || profile.email || '',
  }
}

function getBearerToken(req: Request) {
  const header = req.header('authorization') ?? ''
  const [scheme, token] = header.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new ApiError(401, 'NO_AUTENTICADO', 'Inicia sesion para continuar.')
  }

  return token
}

async function getActiveCreditPackage(admin: unknown, packageId: number) {
  const row = await selectFirst<CreditPackageRow>(
    await (admin as any).database
      .from('credit_packages')
      .select('id, name, credits, price_pen')
      .eq('id', packageId)
      .eq('is_active', true),
  )

  if (!row) {
    throw new ApiError(404, 'PAQUETE_NO_ENCONTRADO', 'El paquete de creditos no esta activo.')
  }

  return row
}

async function getActiveSubscriptionPlan(admin: unknown, planId: number) {
  const row = await selectFirst<SubscriptionPlanRow>(
    await (admin as any).database
      .from('subscription_plans')
      .select('id, name, duration_days, price_pen, included_credits')
      .eq('id', planId)
      .eq('is_active', true),
  )

  if (!row) {
    throw new ApiError(404, 'PLAN_NO_ENCONTRADO', 'El plan TokePro no esta activo.')
  }

  return row
}

async function insertPaymentOrder(admin: unknown, payload: Record<string, unknown>) {
  const { error } = (await (admin as any).database.from('payment_orders').insert([payload])) as DbResponse

  if (error) {
    throw new ApiError(500, 'ORDEN_NO_CREADA', 'No se pudo crear la orden de pago.', error)
  }
}

async function updatePaymentOrder(admin: unknown, orderId: string, payload: Record<string, unknown>) {
  const { error } = (await (admin as any).database
    .from('payment_orders')
    .update(payload)
    .eq('id', orderId)) as DbResponse

  if (error) {
    throw new ApiError(500, 'ORDEN_NO_ACTUALIZADA', 'No se pudo actualizar la orden de pago.', error)
  }
}

async function fulfillPaymentOrder(
  admin: unknown,
  orderId: string,
  payload: {
    providerPaymentId?: string | null
    providerPreapprovalId?: string | null
    providerPayload: unknown
  },
) {
  const { error } = (await (admin as any).database.rpc('fulfill_payment_order', {
    p_order_id: orderId,
    p_provider_payment_id: payload.providerPaymentId ?? null,
    p_provider_preapproval_id: payload.providerPreapprovalId ?? null,
    p_provider_payload: payload.providerPayload,
  })) as DbResponse

  if (error) {
    throw new ApiError(500, 'ORDEN_NO_CUMPLIDA', 'No se pudo cumplir la orden de pago.', error)
  }
}

async function getPaymentOrder(admin: unknown, orderId: string) {
  return await selectFirst<PaymentOrderRow>(
    await (admin as any).database.from('payment_orders').select('id, kind').eq('id', orderId),
  )
}

async function handlePaymentWebhook(paymentId: string) {
  const payment = await mercadoPagoRequest<Record<string, unknown>>(`/v1/payments/${paymentId}`)
  const orderId = getString(payment.external_reference) || getMetadataOrderId(payment)

  if (!orderId) {
    console.warn('[payments/webhook] payment without order reference', paymentId)
    return
  }

  const admin = createInsforgeAdminClient()
  const order = await getPaymentOrder(admin, orderId)

  if (!order) {
    console.warn('[payments/webhook] payment order not found', orderId)
    return
  }

  const paymentStatus = getString(payment.status)
  if (paymentStatus === 'approved') {
    await fulfillPaymentOrder(admin, orderId, {
      providerPaymentId: paymentId,
      providerPayload: payment,
    })
    return
  }

  await updatePaymentOrder(admin, orderId, {
    status: mapMercadoPagoStatus(paymentStatus),
    provider_payment_id: paymentId,
    provider_payload: payment,
  })
}

async function handlePreapprovalWebhook(preapprovalId: string) {
  const preapproval = await mercadoPagoRequest<Record<string, unknown>>(`/preapproval/${preapprovalId}`)
  const orderId = getString(preapproval.external_reference) || getMetadataOrderId(preapproval)

  if (!orderId) {
    console.warn('[payments/webhook] preapproval without order reference', preapprovalId)
    return
  }

  const admin = createInsforgeAdminClient()
  const order = await getPaymentOrder(admin, orderId)

  if (!order) {
    console.warn('[payments/webhook] payment order not found', orderId)
    return
  }

  const status = getString(preapproval.status)
  await updatePaymentOrder(admin, orderId, {
    status: mapPreapprovalStatus(status),
    provider_preapproval_id: preapprovalId,
    provider_payload: preapproval,
  })
}

async function mercadoPagoRequest<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  if (!env.mercadoPagoAccessToken) {
    throw new ApiError(503, 'MERCADOPAGO_NO_CONFIGURADO', 'Falta MERCADOPAGO_ACCESS_TOKEN.')
  }

  const response = await fetch(`${mercadoPagoApiBaseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${env.mercadoPagoAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  const text = await response.text()
  const data = text ? (JSON.parse(text) as unknown) : null

  if (!response.ok) {
    throw new ApiError(
      502,
      'MERCADOPAGO_ERROR',
      'Mercado Pago rechazo la operacion.',
      data,
    )
  }

  return data as T
}

function verifyMercadoPagoSignature(req: Request) {
  if (!env.mercadoPagoWebhookSecret) return

  const signature = req.header('x-signature') ?? ''
  const requestId = req.header('x-request-id') ?? ''
  const parts = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, value] = part.split('=')
      return [key?.trim(), value?.trim()]
    }),
  )
  const ts = parts.ts
  const expectedSignature = parts.v1

  if (!ts || !expectedSignature) {
    throw new ApiError(401, 'WEBHOOK_FIRMA_INVALIDA', 'Firma de Mercado Pago invalida.')
  }

  const dataId = getWebhookDataId(req, { preferQuery: true })?.toLowerCase()
  const manifest = [
    dataId ? `id:${dataId};` : '',
    requestId ? `request-id:${requestId};` : '',
    `ts:${ts};`,
  ].join('')
  const hmac = createHmac('sha256', env.mercadoPagoWebhookSecret).update(manifest).digest('hex')
  const received = Buffer.from(expectedSignature, 'hex')
  const expected = Buffer.from(hmac, 'hex')

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new ApiError(401, 'WEBHOOK_FIRMA_INVALIDA', 'Firma de Mercado Pago invalida.')
  }
}

function getWebhookEventType(req: Request) {
  const body = req.body as { type?: unknown; topic?: unknown } | undefined
  const raw = getString(req.query.topic) || getString(req.query.type) || getString(body?.type) || getString(body?.topic)
  return raw.replace(/^topic_/, '')
}

function getWebhookDataId(req: Request, options: { preferQuery?: boolean } = {}) {
  const body = req.body as { data?: { id?: unknown }; id?: unknown } | undefined
  const queryId = getString(req.query['data.id']) || getString(req.query.id)

  if (options.preferQuery) return queryId

  return queryId || getString(body?.data?.id) || getString(body?.id)
}

function isMercadoPagoTestNotification(req: Request, dataId: string) {
  const body = req.body as { id?: unknown; live_mode?: unknown } | undefined

  return dataId === '123456' && getString(body?.id) === '123456' && body?.live_mode === false
}

function getNotificationUrl() {
  return `${env.publicApiUrl}/api/payments/mercadopago/webhook`
}

function getPreferenceReturnUrls(orderId: string) {
  const success = getReturnUrl(env.paymentSuccessUrl, orderId, 'success')
  const failure = getReturnUrl(env.paymentFailureUrl, orderId, 'failure')
  const pending = getReturnUrl(env.paymentPendingUrl, orderId, 'pending')

  if (!success || !failure || !pending) return {}

  return {
    back_urls: { success, failure, pending },
    auto_return: 'approved',
  }
}

function getReturnBaseUrl(status: string) {
  if (status === 'failure') return env.paymentFailureUrl
  if (status === 'pending') return env.paymentPendingUrl
  return env.paymentSuccessUrl
}

function getBackendReturnUrl(orderId: string, status: string) {
  if (!env.publicApiUrl) return undefined

  return getReturnUrl(`${env.publicApiUrl}/api/payments/mercadopago/return`, orderId, status)
}

function getReturnUrl(baseUrl: string, orderId: string, status: string) {
  if (!baseUrl) return undefined

  const url = new URL(baseUrl)
  url.searchParams.set('order_id', orderId)
  url.searchParams.set('status', status)
  return url.toString()
}

function getCheckoutUrl(response: { init_point?: string; sandbox_init_point?: string }) {
  const checkoutUrl = env.mercadoPagoUseSandbox
    ? response.sandbox_init_point || response.init_point
    : response.init_point || response.sandbox_init_point

  if (!checkoutUrl) {
    throw new ApiError(502, 'CHECKOUT_NO_CREADO', 'Mercado Pago no devolvio URL de checkout.')
  }

  return checkoutUrl
}

function toAmount(value: string | number) {
  const amount = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(500, 'MONTO_INVALIDO', 'El monto configurado no es valido.')
  }

  return Number(amount.toFixed(2))
}

async function selectFirst<T>(response: DbResponse): Promise<T | null> {
  if (response.error) {
    throw new ApiError(500, 'DATABASE_ERROR', 'Error consultando la base de datos.', response.error)
  }

  return Array.isArray(response.data) ? ((response.data[0] as T | undefined) ?? null) : ((response.data as T | null) ?? null)
}

function getMetadataOrderId(data: Record<string, unknown>) {
  const metadata = data.metadata as Record<string, unknown> | undefined
  return getString(metadata?.order_id)
}

function getString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function mapMercadoPagoStatus(status: string) {
  if (status === 'approved' || status === 'authorized') return 'approved'
  if (status === 'cancelled' || status === 'canceled') return 'cancelled'
  if (status === 'refunded' || status === 'charged_back') return 'refunded'
  if (status === 'rejected') return 'rejected'
  if (status === 'expired') return 'expired'
  return 'pending'
}

function mapPreapprovalStatus(status: string) {
  if (status === 'cancelled' || status === 'canceled') return 'cancelled'
  if (status === 'expired') return 'expired'
  return 'pending'
}
