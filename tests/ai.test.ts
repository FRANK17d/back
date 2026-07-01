import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'

// Mock InsForge client
vi.mock('../src/infrastructure/insforge/client.js', () => ({
  createInsforgeAdminClient: () => ({
    database: {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null, count: 0 }),
      }),
    },
  }),
  createInsforgeServerClient: () => ({
    database: {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [{ id: 1, name: 'Gasfitería' }, { id: 2, name: 'Electricidad' }], error: null }),
        }),
      }),
    },
  }),
}))

// Mock the AI service directly
vi.mock('../src/modules/ai/ai-service.js', () => ({
  isAiConfigured: () => true,
  AiNotConfiguredError: class extends Error {},
  suggestCategory: vi.fn().mockResolvedValue({ category_id: 1, confidence: 0.9 }),
  analyzeVerificationDocument: vi.fn().mockResolvedValue({ valid: true, type: 'dni' }),
  moderateRequest: vi.fn().mockResolvedValue({ approved: true, reason: 'ok' }),
  supportChat: vi.fn().mockResolvedValue('Hola, en qué puedo ayudarte?'),
}))

let app: import('express').Express

beforeAll(async () => {
  const { createApp } = await import('../src/app.js')
  app = createApp()
})

describe('AI Routes', () => {
  describe('POST /api/ai/suggest-category', () => {
    it('returns 400 when description is missing', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-category')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('description required')
    })

    it('returns suggestion when description is provided', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-category')
        .send({ description: 'Necesito arreglar una tubería rota' })

      expect(res.status).toBe(200)
      expect(res.body.category_id).toBeDefined()
    })
  })

  describe('POST /api/ai/analyze-document', () => {
    it('returns 400 when fields are missing', async () => {
      const res = await request(app)
        .post('/api/ai/analyze-document')
        .send({ image_url: 'https://example.com/img.jpg' })

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid document_type', async () => {
      const res = await request(app)
        .post('/api/ai/analyze-document')
        .send({ image_url: 'https://example.com/img.jpg', document_type: 'invalid' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('document_type')
    })

    it('returns analysis when valid', async () => {
      const res = await request(app)
        .post('/api/ai/analyze-document')
        .send({ image_url: 'https://example.com/img.jpg', document_type: 'dni' })

      expect(res.status).toBe(200)
      expect(res.body.valid).toBe(true)
    })
  })

  describe('POST /api/ai/moderate-request', () => {
    it('returns 400 when title/description are missing', async () => {
      const res = await request(app)
        .post('/api/ai/moderate-request')
        .send({ title: 'Fix pipe' })

      expect(res.status).toBe(400)
    })

    it('returns moderation result', async () => {
      const res = await request(app)
        .post('/api/ai/moderate-request')
        .send({ title: 'Arreglar tubería', description: 'Se rompió el caño del baño' })

      expect(res.status).toBe(200)
      expect(res.body.approved).toBe(true)
    })
  })

  describe('POST /api/ai/support', () => {
    it('returns 400 when message is missing', async () => {
      const res = await request(app)
        .post('/api/ai/support')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('message required')
    })

    it('returns AI response', async () => {
      const res = await request(app)
        .post('/api/ai/support')
        .send({ message: 'Cómo contrato un técnico?' })

      expect(res.status).toBe(200)
      expect(res.body.response).toBeDefined()
    })
  })
})
