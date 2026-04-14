import { createInsforgeServerClient } from '../../infrastructure/insforge/client.js'
import type { RequestMeta } from './admin-auth.types.js'

type AdminDbUser = {
  id: string
  auth_user_id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'client' | 'technician'
  is_active: boolean
  last_login_at: string | null
  deleted_at: string | null
}

const ADMIN_USER_COLUMNS = [
  'id',
  'auth_user_id',
  'email',
  'first_name',
  'last_name',
  'role',
  'is_active',
  'last_login_at',
  'deleted_at',
].join(', ')

function isEligibleAdmin(user: AdminDbUser | null) {
  return !!user && user.role === 'admin' && user.is_active && !user.deleted_at
}

function asAdminDbUser(value: unknown) {
  return value as AdminDbUser
}

export async function findEligibleAdminByAuthUserId(authUserId: string) {
  const insforge = createInsforgeServerClient()
  const { data, error } = await insforge.database
    .from('usuarios')
    .select(ADMIN_USER_COLUMNS)
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const user = asAdminDbUser(data)
  return isEligibleAdmin(user) ? user : null
}

export async function findEligibleAdminByEmail(email: string) {
  const insforge = createInsforgeServerClient()
  const { data, error } = await insforge.database
    .from('usuarios')
    .select(ADMIN_USER_COLUMNS)
    .eq('email', email)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const user = asAdminDbUser(data)
  return isEligibleAdmin(user) ? user : null
}

export async function touchLastLogin(accessToken: string, userId: string, timestamp: string) {
  const insforge = createInsforgeServerClient(accessToken)
  await insforge.database.from('usuarios').update({ last_login_at: timestamp }).eq('id', userId)
}

export async function createAuditEntry(
  accessToken: string | undefined,
  payload: {
    userId: string | null
    action: string
    recordId?: string | null
    newValues?: Record<string, unknown> | null
    oldValues?: Record<string, unknown> | null
    meta: RequestMeta
  },
) {
  const insforge = createInsforgeServerClient(accessToken)

  await insforge.database.from('registros_auditoria').insert([
    {
      user_id: payload.userId,
      action: payload.action,
      table_name: 'admin_sessions',
      record_id: payload.recordId ?? null,
      new_values: payload.newValues ?? null,
      old_values: payload.oldValues ?? null,
      ip_address: payload.meta.ipAddress,
      user_agent: payload.meta.userAgent,
    },
  ])
}

export function buildAdminUser(user: AdminDbUser) {
  const nombreCompleto = `${user.first_name} ${user.last_name}`.trim()

  return {
    id: user.id,
    authUserId: user.auth_user_id,
    email: user.email,
    nombres: user.first_name,
    apellidos: user.last_name,
    nombreCompleto,
    rol: 'admin' as const,
    activo: user.is_active,
    ultimoIngreso: user.last_login_at,
  }
}
