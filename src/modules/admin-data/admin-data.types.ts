// ── Pagination ──
export type PaginationParams = {
  page: number
  limit: number
}

export type PaginatedResult<T> = {
  datos: T[]
  paginacion: {
    pagina: number
    limite: number
    total: number
    totalPaginas: number
  }
}

// ── Dashboard ──
export type DashboardStats = {
  usuarios: { total: number; activos: number; admins: number; clientes: number; tecnicos: number }
  reservas: { total: number; pendientes: number; activas: number; completadas: number; canceladas: number }
  servicios: { total: number; activos: number; categorias: number }
  disputas: { abiertas: number; total: number }
  verificaciones: { pendientes: number }
  auditoria: { total: number }
}

// ── Usuarios ──
export type AdminUserRow = {
  id: string
  auth_user_id: string
  email: string
  first_name: string
  last_name: string
  avatar_url: string | null
  role: 'admin' | 'client' | 'technician'
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ── Perfiles técnico ──
export type TechnicianProfileRow = {
  id: string
  user_id: string
  phone: string
  bio: string | null
  dni: string | null
  professional_license: string | null
  rating_avg: number
  rating_count: number
  total_jobs: number
  is_available: boolean
  balance: number
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  commission_rate: number
  approved_at: string | null
  created_at: string
  updated_at: string
}

// ── Verificaciones técnico ──
export type VerificationRow = {
  id: string
  technician_id: string
  admin_id: string
  step: string
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  reject_reason: string | null
  created_at: string
}

// ── Servicios ──
export type ServiceRow = {
  id: string
  category_id: string
  name: string
  slug: string
  description: string | null
  price_type: 'hourly' | 'fixed' | 'quote'
  suggested_min_price: number
  suggested_max_price: number
  estimated_minutes: number | null
  icon_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CategoryRow = {
  id: string
  name: string
  slug: string
  icon_url: string | null
  description: string | null
  is_active: boolean
  display_order: number
  created_at: string
}

// ── Reservas ──
export type BookingRow = {
  id: string
  client_id: string
  technician_id: string
  service_id: string
  tech_service_id: string
  address_id: string
  status: string
  estimated_hours: number
  hourly_rate: number
  estimated_total: number | null
  actual_hours: number | null
  actual_total: number | null
  scheduled_at: string
  confirmed_at: string | null
  started_at: string | null
  completed_at: string | null
  client_notes: string | null
  cancellation_reason: string | null
  cancel_note: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

// ── Disputas ──
export type DisputeRow = {
  id: string
  booking_id: string
  raised_by: string
  reason_category: string
  description: string
  evidence_urls: string[] | null
  status: 'open' | 'under_review' | 'resolved' | 'closed'
  resolved_by: string | null
  resolution: string | null
  resolution_note: string | null
  refund_amount: number | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

// ── Auditoría ──
export type AuditLogRow = {
  id: string
  user_id: string | null
  action: string
  table_name: string
  record_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}
