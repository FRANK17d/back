import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'

// Mock InsForge client
vi.mock('../src/infrastructure/insforge/client.js', () => ({
  createInsforgeAdminClient: () => ({
    database: {
      from: () => ({
        select: (_cols: string, _opts?: unknown) =>
          Promise.resolve({ data: [], error: null, count: 5 }),
      }),
    },
  }),
  createInsforgeServerClient: () => ({
    database: {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    },
  }),
}))

// Must import after mocks are set
let app: import('express').Express

beforeAll(async () => {
  const { createApp } = await import('../src/app.js')
  app = createApp()
})

describe('GET /health', () => {
  it('returns 200 with ok: true when db responds', async () => {
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.datos).toBeDefined()
    expect(res.body.datos.servicio).toBe('backend-toke')
    expect(res.body.datos.db).toBe('ok')
  })

  it('includes mercadopago and ai status', async () => {
    const res = await request(app).get('/health')

    expect(res.body.datos.mercadopago).toBe('configurado')
    expect(res.body.datos.ai).toBe('configurado')
  })
})

describe('404 handler', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent-route')

    expect(res.status).toBe(404)
    expect(res.body.ok).toBe(false)
  })
})

describe('CORS', () => {
  it('allows requests without Origin header (mobile)', async () => {
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
  })

  it('allows requests from configured APP_ORIGIN', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000')

    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
  })
})

describe('JSON parsing', () => {
  it('accepts valid JSON body', async () => {
    const res = await request(app)
      .post('/api/ai/suggest-category')
      .send({ description: 'test' })
      .set('Content-Type', 'application/json')

    // Should not fail with parse error (may get 503 if AI check fails differently)
    expect(res.status).not.toBe(415)
  })
})
