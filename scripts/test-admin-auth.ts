import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import { createApp } from '../src/app.js'

type CookieJar = Map<string, string>

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL?.trim()
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD?.trim()
const APP_ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:3000'

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('Faltan TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD para ejecutar test-admin-auth.')
}

function getCookieHeader(jar: CookieJar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

function storeSetCookieHeaders(headers: Headers, jar: CookieJar) {
  for (const cookie of headers.getSetCookie()) {
    const [pair] = cookie.split(';')
    const separatorIndex = pair.indexOf('=')
    const name = pair.slice(0, separatorIndex)
    const value = pair.slice(separatorIndex + 1)

    if (!value) {
      jar.delete(name)
      continue
    }

    jar.set(name, value)
  }
}

async function requestJson(input: {
  baseUrl: string
  path: string
  method?: string
  body?: unknown
  jar?: CookieJar
  origin?: string
}) {
  const headers = new Headers()

  if (typeof input.body !== 'undefined') {
    headers.set('content-type', 'application/json')
  }

  if (input.origin) {
    headers.set('origin', input.origin)
  }

  if (input.jar && input.jar.size > 0) {
    headers.set('cookie', getCookieHeader(input.jar))
  }

  const response = await fetch(`${input.baseUrl}${input.path}`, {
    method: input.method ?? 'GET',
    headers,
    body: typeof input.body === 'undefined' ? undefined : JSON.stringify(input.body),
  })

  if (input.jar) {
    storeSetCookieHeaders(response.headers, input.jar)
  }

  const text = await response.text()
  const json = text ? (JSON.parse(text) as unknown) : null

  return {
    status: response.status,
    json,
  }
}

async function main() {
  const app = createApp()
  const server = createServer(app)

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`
  const sessionJar: CookieJar = new Map()

  try {
    const health = await requestJson({ baseUrl, path: '/health' })
    assert.equal(health.status, 200)

    const blockedOrigin = await requestJson({
      baseUrl,
      path: '/api/admin/sessions',
      method: 'POST',
      origin: 'http://evil.example',
      body: { correo: ADMIN_EMAIL, contrasena: ADMIN_PASSWORD },
    })
    assert.equal(blockedOrigin.status, 403)

    const invalidLogin = await requestJson({
      baseUrl,
      path: '/api/admin/sessions',
      method: 'POST',
      origin: APP_ORIGIN,
      body: { correo: ADMIN_EMAIL, contrasena: 'contrasena-mala' },
    })
    assert.equal(invalidLogin.status, 401)

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const rateAttempt = await requestJson({
        baseUrl,
        path: '/api/admin/sessions',
        method: 'POST',
        origin: APP_ORIGIN,
        body: { correo: 'rate.limit.admin@example.com', contrasena: 'bad-password' },
      })

      assert.equal(rateAttempt.status, 401)
    }

    const rateLimited = await requestJson({
      baseUrl,
      path: '/api/admin/sessions',
      method: 'POST',
      origin: APP_ORIGIN,
      body: { correo: 'rate.limit.admin@example.com', contrasena: 'bad-password' },
    })
    assert.equal(rateLimited.status, 429)

    const login = await requestJson({
      baseUrl,
      path: '/api/admin/sessions',
      method: 'POST',
      origin: APP_ORIGIN,
      body: { correo: ADMIN_EMAIL, contrasena: ADMIN_PASSWORD },
      jar: sessionJar,
    })
    assert.equal(login.status, 200)

    const currentSession = await requestJson({
      baseUrl,
      path: '/api/admin/sessions/current',
      jar: sessionJar,
    })
    assert.equal(currentSession.status, 200)

    const refresh = await requestJson({
      baseUrl,
      path: '/api/admin/sessions/refresh',
      method: 'POST',
      origin: APP_ORIGIN,
      jar: sessionJar,
    })
    assert.equal(refresh.status, 200)

    const resetRequest = await requestJson({
      baseUrl,
      path: '/api/admin/password-reset-requests',
      method: 'POST',
      origin: APP_ORIGIN,
      body: { correo: 'nobody@example.com' },
    })
    assert.equal(resetRequest.status, 200)

    const resetVerification = await requestJson({
      baseUrl,
      path: '/api/admin/password-reset-verifications',
      method: 'POST',
      origin: APP_ORIGIN,
      body: { correo: ADMIN_EMAIL, codigo: '000000' },
    })
    assert.equal(resetVerification.status, 400)

    const resetPassword = await requestJson({
      baseUrl,
      path: '/api/admin/password-resets',
      method: 'POST',
      origin: APP_ORIGIN,
      body: { token: 'invalid-token', nuevaContrasena: 'NuevaClave123' },
    })
    assert.equal(resetPassword.status, 400)

    const logout = await requestJson({
      baseUrl,
      path: '/api/admin/sessions/current',
      method: 'DELETE',
      origin: APP_ORIGIN,
      jar: sessionJar,
    })
    assert.equal(logout.status, 200)

    const sessionAfterLogout = await requestJson({
      baseUrl,
      path: '/api/admin/sessions/current',
      jar: sessionJar,
    })
    assert.equal(sessionAfterLogout.status, 401)

    console.log('Admin auth endpoint tests passed.')
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
}

await main()
