import { createInsforgeServerClient } from '../../infrastructure/insforge/client.js'
import type {
  AdminUserRow,
  AuditLogRow,
  BookingRow,
  CategoryRow,
  DisputeRow,
  PaginatedResult,
  PaginationParams,
  ServiceRow,
  TechnicianProfileRow,
  VerificationRow,
} from './admin-data.types.js'

// ─── Helpers ───

function paginate<T>(
  data: T[] | null,
  count: number | null,
  params: PaginationParams,
): PaginatedResult<T> {
  const total = count ?? 0
  return {
    datos: data ?? [],
    paginacion: {
      pagina: params.page,
      limite: params.limit,
      total,
      totalPaginas: Math.ceil(total / params.limit),
    },
  }
}

function rangeFromPage(page: number, limit: number): [number, number] {
  const from = (page - 1) * limit
  return [from, from + limit - 1]
}

// ─── Dashboard Stats ───

export async function getDashboardStats(accessToken: string) {
  const insforge = createInsforgeServerClient(accessToken)

  const [
    usersRes,
    activeUsersRes,
    adminUsersRes,
    clientUsersRes,
    techUsersRes,
    bookingsRes,
    pendingBookingsRes,
    activeBookingsRes,
    completedBookingsRes,
    cancelledBookingsRes,
    servicesRes,
    activeServicesRes,
    categoriesRes,
    openDisputesRes,
    totalDisputesRes,
    pendingVerificationsRes,
    auditRes,
  ] = await Promise.all([
    insforge.database.from('usuarios').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    insforge.database.from('usuarios').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
    insforge.database.from('usuarios').select('id', { count: 'exact', head: true }).eq('role', 'admin').is('deleted_at', null),
    insforge.database.from('usuarios').select('id', { count: 'exact', head: true }).eq('role', 'client').is('deleted_at', null),
    insforge.database.from('usuarios').select('id', { count: 'exact', head: true }).eq('role', 'technician').is('deleted_at', null),
    insforge.database.from('reservas').select('id', { count: 'exact', head: true }),
    insforge.database.from('reservas').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    insforge.database.from('reservas').select('id', { count: 'exact', head: true }).in('status', ['confirmed', 'in_progress']),
    insforge.database.from('reservas').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    insforge.database.from('reservas').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
    insforge.database.from('servicios').select('id', { count: 'exact', head: true }),
    insforge.database.from('servicios').select('id', { count: 'exact', head: true }).eq('is_active', true),
    insforge.database.from('categorias_servicio').select('id', { count: 'exact', head: true }),
    insforge.database.from('disputas').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    insforge.database.from('disputas').select('id', { count: 'exact', head: true }),
    insforge.database.from('verificaciones_tecnico').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    insforge.database.from('registros_auditoria').select('id', { count: 'exact', head: true }),
  ])

  return {
    usuarios: {
      total: usersRes.count ?? 0,
      activos: activeUsersRes.count ?? 0,
      admins: adminUsersRes.count ?? 0,
      clientes: clientUsersRes.count ?? 0,
      tecnicos: techUsersRes.count ?? 0,
    },
    reservas: {
      total: bookingsRes.count ?? 0,
      pendientes: pendingBookingsRes.count ?? 0,
      activas: activeBookingsRes.count ?? 0,
      completadas: completedBookingsRes.count ?? 0,
      canceladas: cancelledBookingsRes.count ?? 0,
    },
    servicios: {
      total: servicesRes.count ?? 0,
      activos: activeServicesRes.count ?? 0,
      categorias: categoriesRes.count ?? 0,
    },
    disputas: {
      abiertas: openDisputesRes.count ?? 0,
      total: totalDisputesRes.count ?? 0,
    },
    verificaciones: {
      pendientes: pendingVerificationsRes.count ?? 0,
    },
    auditoria: {
      total: auditRes.count ?? 0,
    },
  }
}

// ─── Users ───

const USER_COLUMNS = 'id, auth_user_id, email, first_name, last_name, avatar_url, role, is_active, last_login_at, created_at, updated_at, deleted_at'

export async function getUsers(
  accessToken: string,
  params: PaginationParams & { search?: string; role?: string; active?: string },
): Promise<PaginatedResult<AdminUserRow>> {
  const insforge = createInsforgeServerClient(accessToken)
  const [from, to] = rangeFromPage(params.page, params.limit)

  let query = insforge.database
    .from('usuarios')
    .select(USER_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.role) query = query.eq('role', params.role)
  if (params.active === 'true') query = query.eq('is_active', true)
  if (params.active === 'false') query = query.eq('is_active', false)
  if (params.search) query = query.or(`email.ilike.%${params.search}%,first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%`)

  const { data, count } = await query
  return paginate(data as AdminUserRow[] | null, count, params)
}

export async function getUserById(accessToken: string, id: string) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data } = await insforge.database
    .from('usuarios')
    .select(USER_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  return data as AdminUserRow | null
}

export async function updateUser(accessToken: string, id: string, updates: { is_active?: boolean }) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data, error } = await insforge.database
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select(USER_COLUMNS)
    .maybeSingle()
  return { data: data as AdminUserRow | null, error }
}

// ─── Technicians ───

const TECH_COLUMNS = 'id, user_id, phone, bio, dni, professional_license, rating_avg, rating_count, total_jobs, is_available, balance, status, commission_rate, approved_at, created_at, updated_at'

export async function getTechnicians(
  accessToken: string,
  params: PaginationParams & { search?: string; status?: string },
): Promise<PaginatedResult<TechnicianProfileRow & { usuario?: AdminUserRow }>> {
  const insforge = createInsforgeServerClient(accessToken)
  const [from, to] = rangeFromPage(params.page, params.limit)

  let query = insforge.database
    .from('perfiles_tecnico')
    .select(`${TECH_COLUMNS}, usuarios!perfiles_tecnico_user_id_fkey(${USER_COLUMNS})`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.status) query = query.eq('status', params.status)
  // search requires join — we filter in service layer if needed

  const { data, count } = await query
  // Flatten the joined usuario
  const rows = (data ?? []).map((row: Record<string, unknown>) => {
    const { usuarios, ...rest } = row
    return { ...rest, usuario: usuarios ?? undefined }
  })
  return paginate(rows as (TechnicianProfileRow & { usuario?: AdminUserRow })[], count, params)
}

export async function getTechnicianById(accessToken: string, id: string) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data } = await insforge.database
    .from('perfiles_tecnico')
    .select(`${TECH_COLUMNS}, usuarios!perfiles_tecnico_user_id_fkey(${USER_COLUMNS})`)
    .eq('id', id)
    .maybeSingle()

  if (!data) return null
  const { usuarios, ...rest } = data as Record<string, unknown>
  return { ...rest, usuario: usuarios ?? undefined } as TechnicianProfileRow & { usuario?: AdminUserRow }
}

export async function updateTechnicianStatus(
  accessToken: string,
  id: string,
  updates: { status: string; approved_at?: string },
) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data, error } = await insforge.database
    .from('perfiles_tecnico')
    .update(updates)
    .eq('id', id)
    .select(TECH_COLUMNS)
    .maybeSingle()
  return { data: data as TechnicianProfileRow | null, error }
}

// ─── Verifications ───

const VERIF_COLUMNS = 'id, technician_id, admin_id, step, status, notes, reject_reason, created_at'

export async function getVerifications(
  accessToken: string,
  params: PaginationParams & { status?: string },
): Promise<PaginatedResult<VerificationRow>> {
  const insforge = createInsforgeServerClient(accessToken)
  const [from, to] = rangeFromPage(params.page, params.limit)

  let query = insforge.database
    .from('verificaciones_tecnico')
    .select(VERIF_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.status) query = query.eq('status', params.status)

  const { data, count } = await query
  return paginate(data as VerificationRow[] | null, count, params)
}

export async function createVerification(
  accessToken: string,
  technicianId: string,
  adminId: string,
  body: { step: string; status: string; notes?: string; reject_reason?: string },
) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data, error } = await insforge.database
    .from('verificaciones_tecnico')
    .upsert(
      {
        technician_id: technicianId,
        admin_id: adminId,
        step: body.step,
        status: body.status,
        notes: body.notes ?? null,
        reject_reason: body.reject_reason ?? null,
      },
      { onConflict: 'technician_id, step' },
    )
    .select(VERIF_COLUMNS)
    .maybeSingle()
  return { data: data as VerificationRow | null, error }
}

// ─── Services ───

const SERVICE_COLUMNS = 'id, category_id, name, slug, description, price_type, suggested_min_price, suggested_max_price, estimated_minutes, icon_url, is_active, created_at, updated_at'

export async function getServices(
  accessToken: string,
  params: PaginationParams & { search?: string; category_id?: string; active?: string },
): Promise<PaginatedResult<ServiceRow>> {
  const insforge = createInsforgeServerClient(accessToken)
  const [from, to] = rangeFromPage(params.page, params.limit)

  let query = insforge.database
    .from('servicios')
    .select(SERVICE_COLUMNS, { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to)

  if (params.category_id) query = query.eq('category_id', params.category_id)
  if (params.active === 'true') query = query.eq('is_active', true)
  if (params.active === 'false') query = query.eq('is_active', false)
  if (params.search) query = query.ilike('name', `%${params.search}%`)

  const { data, count } = await query
  return paginate(data as ServiceRow[] | null, count, params)
}

export async function createService(accessToken: string, body: Partial<ServiceRow>) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data, error } = await insforge.database
    .from('servicios')
    .insert([body])
    .select(SERVICE_COLUMNS)
    .maybeSingle()
  return { data: data as ServiceRow | null, error }
}

export async function updateService(accessToken: string, id: string, body: Partial<ServiceRow>) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data, error } = await insforge.database
    .from('servicios')
    .update(body)
    .eq('id', id)
    .select(SERVICE_COLUMNS)
    .maybeSingle()
  return { data: data as ServiceRow | null, error }
}

// ─── Categories ───

const CATEGORY_COLUMNS = 'id, name, slug, icon_url, description, is_active, display_order, created_at'

export async function getCategories(accessToken: string) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data } = await insforge.database
    .from('categorias_servicio')
    .select(CATEGORY_COLUMNS)
    .order('display_order', { ascending: true })
  return (data ?? []) as CategoryRow[]
}

export async function createCategory(accessToken: string, body: Partial<CategoryRow>) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data, error } = await insforge.database
    .from('categorias_servicio')
    .insert([body])
    .select(CATEGORY_COLUMNS)
    .maybeSingle()
  return { data: data as CategoryRow | null, error }
}

export async function updateCategory(accessToken: string, id: string, body: Partial<CategoryRow>) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data, error } = await insforge.database
    .from('categorias_servicio')
    .update(body)
    .eq('id', id)
    .select(CATEGORY_COLUMNS)
    .maybeSingle()
  return { data: data as CategoryRow | null, error }
}

// ─── Bookings ───

const BOOKING_COLUMNS = 'id, client_id, technician_id, service_id, tech_service_id, address_id, status, estimated_hours, hourly_rate, estimated_total, actual_hours, actual_total, scheduled_at, confirmed_at, started_at, completed_at, client_notes, cancellation_reason, cancel_note, cancelled_at, created_at, updated_at'

export async function getBookings(
  accessToken: string,
  params: PaginationParams & { status?: string },
): Promise<PaginatedResult<BookingRow>> {
  const insforge = createInsforgeServerClient(accessToken)
  const [from, to] = rangeFromPage(params.page, params.limit)

  let query = insforge.database
    .from('reservas')
    .select(BOOKING_COLUMNS, { count: 'exact' })
    .order('scheduled_at', { ascending: false })
    .range(from, to)

  if (params.status) query = query.eq('status', params.status)

  const { data, count } = await query
  return paginate(data as BookingRow[] | null, count, params)
}

export async function getBookingById(accessToken: string, id: string) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data } = await insforge.database
    .from('reservas')
    .select(BOOKING_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  return data as BookingRow | null
}

// ─── Disputes ───

const DISPUTE_COLUMNS = 'id, booking_id, raised_by, reason_category, description, evidence_urls, status, resolved_by, resolution, resolution_note, refund_amount, resolved_at, created_at, updated_at'

export async function getDisputes(
  accessToken: string,
  params: PaginationParams & { status?: string },
): Promise<PaginatedResult<DisputeRow>> {
  const insforge = createInsforgeServerClient(accessToken)
  const [from, to] = rangeFromPage(params.page, params.limit)

  let query = insforge.database
    .from('disputas')
    .select(DISPUTE_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.status) query = query.eq('status', params.status)

  const { data, count } = await query
  return paginate(data as DisputeRow[] | null, count, params)
}

export async function getDisputeById(accessToken: string, id: string) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data } = await insforge.database
    .from('disputas')
    .select(DISPUTE_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  return data as DisputeRow | null
}

export async function resolveDispute(
  accessToken: string,
  id: string,
  adminId: string,
  body: { resolution: string; resolution_note: string; refund_amount?: number },
) {
  const insforge = createInsforgeServerClient(accessToken)
  const { data, error } = await insforge.database
    .from('disputas')
    .update({
      status: 'resolved',
      resolved_by: adminId,
      resolution: body.resolution,
      resolution_note: body.resolution_note,
      refund_amount: body.refund_amount ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(DISPUTE_COLUMNS)
    .maybeSingle()
  return { data: data as DisputeRow | null, error }
}

// ─── Audit Logs ───

const AUDIT_COLUMNS = 'id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at'

export async function getAuditLogs(
  accessToken: string,
  params: PaginationParams & { action?: string; table_name?: string },
): Promise<PaginatedResult<AuditLogRow>> {
  const insforge = createInsforgeServerClient(accessToken)
  const [from, to] = rangeFromPage(params.page, params.limit)

  let query = insforge.database
    .from('registros_auditoria')
    .select(AUDIT_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.action) query = query.eq('action', params.action)
  if (params.table_name) query = query.eq('table_name', params.table_name)

  const { data, count } = await query
  return paginate(data as AuditLogRow[] | null, count, params)
}
