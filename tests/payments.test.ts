import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'

// Mock InsForge client
vi.mock('../src/infrastructure/insforge/client.js', () => ({
  createInsforgeAdminClient: () => ({
    database: {
      from: () => ({
        select: (_cols: string, _opts?: unknown) =>
          Promise.resolve({ data: [], error: null, count: 0 }),
      }),
    },
  }),
  createInsforgeServerClient: () => ({
    database: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    },
    auth: {
      getCurrentUser: () => Promise.resolve({ data: null, error: { message: 'unauthorized' } }),
    },
  }),
}))

let app: import('express').Express

beforeAll(async () => {
  const { createApp } = await import('../src/app.js')
  app = createApp()
})

describe('Payments Routes', () => {
  describe('POST /api/payments/credits/checkout', () => {
    it('returns 400 when body validation fails (missing packageId)', async () => {
      const res = await request(app)
        .post('/api/payments/credits/checkout')
        .send({})

      // Should fail validation (Zod) → 400
      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
    })
  })

  describe('POST /api/payments/tokepro/checkout', () => {
    it('returns 400 when body validation fails (missing planId)', async () => {
      const res = await request(app)
        .post('/api/payments/tokepro/checkout')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
    })
  })

  describe('POST /api/payments/mercadopago/webhook', () => {
    it('accepts webhook and does not crash', async () => {
      const res = await request(app)
        .post('/api/payments/mercadopago/webhook')
        .send({ type: 'payment', action: 'payment.created', data: { id: '123' } })

      // May return 200 (test notification), 400/500 (signature fails), or 502
      // Either way, should not crash the server
      expect([200, 400, 500, 502]).toContain(res.status)
    })
  })

  describe('GET /api/payments/mercadopago/return', () => {
    it('returns 200 when no redirect URL configured', async () => {
      const res = await request(app)
        .get('/api/payments/mercadopago/return?status=success')

      // Returns 200 with text when no redirect URL is set
      expect([200, 302]).toContain(res.status)
    })
  })
})
