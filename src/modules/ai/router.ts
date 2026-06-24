import { Router } from 'express'
import {
  suggestCategory,
  analyzeVerificationDocument,
  moderateRequest,
  supportChat,
  isAiConfigured,
  AiNotConfiguredError,
} from './ai-service.js'
import { createInsforgeServerClient } from '../../infrastructure/insforge/client.js'

export const aiRouter = Router()

// Cualquier ruta de IA falla limpio si no hay key configurada.
aiRouter.use((_req, res, next) => {
  if (!isAiConfigured()) {
    return res.status(503).json({
      error: 'ai_not_configured',
      message: 'El servicio de IA no está disponible (falta OPENROUTER_API_KEY).',
    })
  }
  next()
})

function handleAiError(res: import('express').Response, err: unknown) {
  if (err instanceof AiNotConfiguredError) {
    return res.status(503).json({ error: 'ai_not_configured', message: err.message })
  }
  console.error('[ai]', err)
  return res.status(500).json({ error: 'ai_failed', message: 'Error procesando la solicitud de IA.' })
}

// POST /api/ai/suggest-category — sugiere categoría dado un texto
aiRouter.post('/suggest-category', async (req, res) => {
  const { description } = req.body
  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'description required' })
  }

  try {
    const client = createInsforgeServerClient()
    const { data } = await client.database
      .from('service_categories')
      .select('id, name')
      .eq('is_active', true)

    if (!data || (data as unknown[]).length === 0) {
      return res.status(500).json({ error: 'no categories found' })
    }

    const result = await suggestCategory(description, data as { id: string; name: string }[])
    res.json(result)
  } catch (err) {
    handleAiError(res, err)
  }
})

// POST /api/ai/analyze-document — analiza documento de verificación
aiRouter.post('/analyze-document', async (req, res) => {
  const { image_url, document_type } = req.body
  if (!image_url || !document_type) {
    return res.status(400).json({ error: 'image_url and document_type required' })
  }
  if (!['dni', 'certificate', 'selfie'].includes(document_type)) {
    return res.status(400).json({ error: 'document_type must be dni, certificate, or selfie' })
  }

  try {
    const result = await analyzeVerificationDocument(image_url, document_type)
    res.json(result)
  } catch (err) {
    handleAiError(res, err)
  }
})

// POST /api/ai/moderate-request — modera un pedido antes de aprobarlo
aiRouter.post('/moderate-request', async (req, res) => {
  const { title, description } = req.body
  if (!title || !description) {
    return res.status(400).json({ error: 'title and description required' })
  }

  try {
    const result = await moderateRequest(title, description)
    res.json(result)
  } catch (err) {
    handleAiError(res, err)
  }
})

// POST /api/ai/support — chat de soporte con IA
aiRouter.post('/support', async (req, res) => {
  const { message, history } = req.body
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' })
  }

  try {
    const response = await supportChat(message, history ?? [])
    res.json({ response })
  } catch (err) {
    handleAiError(res, err)
  }
})
