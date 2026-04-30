import { z } from 'zod'

// ── Pagination query ──
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ── Users filters ──
export const usersQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  role: z.enum(['admin', 'client', 'technician']).optional(),
  active: z.enum(['true', 'false']).optional(),
})

// ── Technicians filters ──
export const techniciansQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'suspended']).optional(),
})

// ── Update user ──
export const updateUserBody = z.object({
  is_active: z.boolean().optional(),
})

// ── Update technician status ──
export const updateTechnicianStatusBody = z.object({
  status: z.enum(['approved', 'rejected', 'suspended']),
  notes: z.string().trim().max(500).optional(),
})

// ── Services filters ──
export const servicesQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  category_id: z.string().uuid().optional(),
  active: z.enum(['true', 'false']).optional(),
})

// ── Create/update service ──
export const createServiceBody = z.object({
  category_id: z.string().uuid(),
  name: z.string().trim().min(1).max(150),
  slug: z.string().trim().min(1).max(170),
  description: z.string().trim().max(1000).optional(),
  price_type: z.enum(['hourly', 'fixed', 'quote']).default('hourly'),
  suggested_min_price: z.number().min(0).default(0),
  suggested_max_price: z.number().min(0).default(0),
  estimated_minutes: z.number().int().min(0).optional(),
  icon_url: z.string().url().optional(),
  is_active: z.boolean().default(true),
})

export const updateServiceBody = createServiceBody.partial()

// ── Create/update category ──
export const createCategoryBody = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(120),
  icon_url: z.string().url().optional(),
  description: z.string().trim().max(500).optional(),
  is_active: z.boolean().default(true),
  display_order: z.number().int().min(0).default(0),
})

export const updateCategoryBody = createCategoryBody.partial()

// ── Bookings filters ──
export const bookingsQuery = paginationQuery.extend({
  status: z.string().trim().optional(),
})

// ── Disputes filters ──
export const disputesQuery = paginationQuery.extend({
  status: z.enum(['open', 'under_review', 'resolved', 'closed']).optional(),
})

// ── Resolve dispute ──
export const resolveDisputeBody = z.object({
  resolution: z.enum(['refund_full', 'refund_partial', 'no_refund', 'warning', 'ban']),
  resolution_note: z.string().trim().min(1).max(1000),
  refund_amount: z.number().min(0).optional(),
})

// ── Create verification decision ──
export const createVerificationBody = z.object({
  step: z.string().trim().min(1).max(50),
  status: z.enum(['approved', 'rejected']),
  notes: z.string().trim().max(500).optional(),
  reject_reason: z.string().trim().max(500).optional(),
})

// ── Verifications filters ──
export const verificationsQuery = paginationQuery.extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
})

// ── Audit logs filters ──
export const auditLogsQuery = paginationQuery.extend({
  action: z.string().trim().optional(),
  table_name: z.string().trim().optional(),
})
