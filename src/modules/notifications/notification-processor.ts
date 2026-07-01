import { GoogleAuth } from 'google-auth-library'
import { createInsforgeServerClient } from '../../infrastructure/insforge/client.js'
import {
  requestApprovedEmail,
  requestRejectedEmail,
  applicationAcceptedEmail,
  technicianVerifiedEmail,
  verificationRejectedEmail,
  welcomeEmail,
  orderCompletedEmail,
  paymentReceivedEmail,
  newReviewEmail,
  orderCancelledEmail,
} from './email-templates.js'

type Notification = {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  channel: 'push' | 'email' | 'both'
}

const EMAIL_TEMPLATES: Record<string, (data: Record<string, unknown>) => { subject: string; html: string } | null> = {
  request_approved: (d) => requestApprovedEmail(d.request_title as string ?? 'tu pedido'),
  request_rejected: (d) => requestRejectedEmail(d.request_title as string ?? 'tu pedido'),
  application_accepted: (d) => applicationAcceptedEmail(d.request_title as string ?? 'un pedido'),
  technician_verified: () => technicianVerifiedEmail(),
  verification_rejected: () => verificationRejectedEmail(),
  welcome: (d) => welcomeEmail(d.name as string ?? ''),
  order_completed: (d) => orderCompletedEmail(d.request_title as string ?? 'tu servicio'),
  payment_received: (d) => paymentReceivedEmail(d.credits as number ?? 0, d.amount as string ?? '0'),
  new_review: (d) => newReviewEmail(d.rating as number ?? 5, d.client_name as string ?? 'Un cliente', d.request_title as string ?? 'un servicio'),
  order_cancelled: (d) => orderCancelledEmail(d.request_title as string ?? 'un pedido'),
}

const FCM_SERVICE_ACCOUNT_JSON = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim() || ''
const FCM_SERVICE_ACCOUNT_JSON_BASE64 = process.env.FCM_SERVICE_ACCOUNT_JSON_BASE64?.trim() || ''

// ─── FCM v1 Auth ─────────────────────────────────────────────────────────────

let fcmAuth: GoogleAuth | null = null
let fcmProjectId: string | null = null

function getFcmAuth(): { auth: GoogleAuth; projectId: string } | null {
  const credentialsPayload = FCM_SERVICE_ACCOUNT_JSON || (
    FCM_SERVICE_ACCOUNT_JSON_BASE64
      ? Buffer.from(FCM_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8').trim()
      : ''
  )

  if (!credentialsPayload) return null

  if (!fcmAuth) {
    try {
      const credentials = JSON.parse(credentialsPayload)
      fcmProjectId = credentials.project_id
      fcmAuth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      })
    } catch (e) {
      console.error('[notifications] Invalid FCM service account credentials:', e)
      return null
    }
  }

  return fcmAuth && fcmProjectId ? { auth: fcmAuth, projectId: fcmProjectId } : null
}

async function getUserEmail(userId: string): Promise<string | null> {
  const client = createInsforgeServerClient()
  const { data } = await client.database
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()
  return (data as { email: string | null } | null)?.email ?? null
}

async function getUserDeviceTokens(userId: string): Promise<string[]> {
  const client = createInsforgeServerClient()
  const { data } = await client.database
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!data || !Array.isArray(data)) return []
  return (data as { token: string }[]).map((d) => d.token)
}

async function sendPushNotification(notification: Notification) {
  const fcm = getFcmAuth()
  if (!fcm) return // FCM no configurado, skip silenciosamente

  const tokens = await getUserDeviceTokens(notification.user_id)
  if (tokens.length === 0) return

  let accessToken: string
  try {
    const client = await fcm.auth.getClient()
    const tokenRes = await client.getAccessToken()
    accessToken = tokenRes.token ?? ''
    if (!accessToken) return
  } catch (e) {
    console.error('[notifications] FCM auth error:', e)
    return
  }

  const url = `https://fcm.googleapis.com/v1/projects/${fcm.projectId}/messages:send`

  for (const token of tokens) {
    const message = {
      message: {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type,
          notification_id: notification.id,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          ...Object.fromEntries(
            Object.entries(notification.data).map(([k, v]) => [k, String(v)])
          ),
        },
        android: {
          priority: 'high' as const,
          notification: {
            channel_id: 'toke_plus_notifications',
            sound: 'default',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      },
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(message),
      })

      if (response.ok) {
        console.log(`[notifications] Push sent to device for ${notification.id}`)
      } else {
        const errorBody = await response.text()

        // Desactivar tokens inválidos (UNREGISTERED, INVALID_ARGUMENT)
        if (response.status === 404 || response.status === 400) {
          const dbClient = createInsforgeServerClient()
          await dbClient.database
            .from('device_tokens')
            .update({ is_active: false })
            .eq('token', token)
          console.warn(`[notifications] Token invalidated: ${token.substring(0, 20)}...`)
        } else {
          console.error(`[notifications] FCM v1 error ${response.status}: ${errorBody}`)
        }
      }
    } catch (err) {
      console.error(`[notifications] FCM push error:`, err)
    }
  }
}

async function sendEmail(notification: Notification) {
  const templateFn = EMAIL_TEMPLATES[notification.type]
  if (!templateFn) return

  const template = templateFn(notification.data)
  if (!template) return

  const email = await getUserEmail(notification.user_id)
  if (!email) return

  const client = createInsforgeServerClient()
  const { error } = await client.emails.send({
    to: email,
    subject: template.subject,
    html: template.html,
  })

  if (error) {
    console.error(`[notifications] Email failed for ${notification.id}:`, error.message)
  }
}

async function markSent(notificationId: string, success: boolean) {
  const client = createInsforgeServerClient()
  await client.database
    .from('notifications')
    .update({
      status: success ? 'sent' : 'failed',
      sent_at: success ? new Date().toISOString() : null,
    })
    .eq('id', notificationId)
}

export async function processNotification(notification: Notification) {
  try {
    // Enviar push notification (funciona en background/terminated)
    if (notification.channel === 'push' || notification.channel === 'both') {
      await sendPushNotification(notification)
    }

    // Enviar email
    if (notification.channel === 'email' || notification.channel === 'both') {
      await sendEmail(notification)
    }

    await markSent(notification.id, true)
  } catch (err) {
    console.error(`[notifications] Processing failed for ${notification.id}:`, err)
    await markSent(notification.id, false)
  }
}

export async function processPendingNotifications() {
  const client = createInsforgeServerClient()
  const { data, error } = await client.database
    .from('notifications')
    .select('id, user_id, type, title, body, data, channel')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50)

  if (error || !data) return

  const notifications = data as Notification[]

  for (const notification of notifications) {
    await processNotification(notification)
  }

  if (notifications.length > 0) {
    console.log(`[notifications] Processed ${notifications.length} notification(s)`)
  }
}
