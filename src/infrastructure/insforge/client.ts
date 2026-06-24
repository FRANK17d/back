import { createClient } from '@insforge/sdk'
import { env } from '../../config/env.js'

export function createInsforgeServerClient(accessToken?: string) {
  return createClient({
    baseUrl: env.insforgeUrl,
    anonKey: env.insforgeAnonKey,
    isServerMode: true,
    edgeFunctionToken: accessToken,
  })
}

export function createInsforgeAdminClient() {
  if (!env.insforgeApiKey) {
    throw new Error('Falta la variable de entorno obligatoria: INSFORGE_API_KEY')
  }

  return createClient({
    baseUrl: env.insforgeUrl,
    anonKey: env.insforgeApiKey,
    isServerMode: true,
  })
}
