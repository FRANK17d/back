import { createInsforgeServerClient } from '../../infrastructure/insforge/client.js'
import {
  requestApprovedEmail,
  requestRejectedEmail,
  applicationAcceptedEmail,
  technicianVerifiedEmail,
  verificationRejectedEmail,
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
    // Push in-app ya fue despachado por el trigger (realtime.publish).
    // Aquí solo procesamos el canal email.
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
