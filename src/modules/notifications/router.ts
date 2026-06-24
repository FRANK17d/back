import { Router } from 'express'
import { processPendingNotifications } from './notification-processor.js'

export const notificationsRouter = Router()

// POST /api/notifications/process — procesa las notificaciones pendientes.
// Protegido por un secret en el header (para cron/webhook).
notificationsRouter.post('/process', async (req, res) => {
  const secret = process.env.NOTIFICATIONS_CRON_SECRET
  if (secret && req.headers['x-cron-secret'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    await processPendingNotifications()
    res.json({ ok: true })
  } catch (err) {
    console.error('[notifications/process]', err)
    res.status(500).json({ error: 'processing_failed' })
  }
})
