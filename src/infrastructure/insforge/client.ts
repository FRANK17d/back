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
