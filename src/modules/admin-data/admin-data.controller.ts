import type { Request, Response } from 'express'
import { ApiError } from '../../shared/http/api-error.js'
import type { AdminSession } from '../admin-auth/admin-auth.types.js'
import * as repo from './admin-data.repository.js'
import {
  auditLogsQuery,
  bookingsQuery,
  createCategoryBody,
  createServiceBody,
  createVerificationBody,
  disputesQuery,
  resolveDisputeBody,
  servicesQuery,
  techniciansQuery,
  updateCategoryBody,
  updateServiceBody,
  updateTechnicianStatusBody,
  updateUserBody,
  usersQuery,
  verificationsQuery,
} from './admin-data.schemas.js'

function session(req: Request): AdminSession {
  if (!req.adminSession) throw new ApiError(401, 'SESION_REQUERIDA', 'Sesión no encontrada.')
  return req.adminSession
}

/** Express 5 types params as string | string[]; coerce to string. */
function param(req: Request, name: string): string {
  const v = req.params[name]
  if (Array.isArray(v)) return v[0]
  if (!v) throw new ApiError(400, 'PARAM_REQUERIDO', `Parámetro ${name} es requerido.`)
  return v
}

// ── Dashboard ──

export async function getDashboardStatsController(req: Request, res: Response) {
  const s = session(req)
  const stats = await repo.getDashboardStats(s.accessToken)
  res.json({ ok: true, datos: stats })
}

// ── Users ──

export async function getUsersController(req: Request, res: Response) {
  const s = session(req)
  const params = usersQuery.parse(req.query)
  const result = await repo.getUsers(s.accessToken, params)
  res.json({ ok: true, ...result })
}

export async function getUserByIdController(req: Request, res: Response) {
  const s = session(req)
  const user = await repo.getUserById(s.accessToken, param(req, 'id'))
  if (!user) throw new ApiError(404, 'USUARIO_NO_ENCONTRADO', 'No se encontró el usuario.')
  res.json({ ok: true, datos: user })
}

export async function updateUserController(req: Request, res: Response) {
  const s = session(req)
  const body = updateUserBody.parse(req.body)
  const { data, error } = await repo.updateUser(s.accessToken, param(req, 'id'), body)
  if (error || !data) throw new ApiError(400, 'UPDATE_FAILED', 'No se pudo actualizar el usuario.')
  res.json({ ok: true, datos: data })
}

// ── Technicians ──

export async function getTechniciansController(req: Request, res: Response) {
  const s = session(req)
  const params = techniciansQuery.parse(req.query)
  const result = await repo.getTechnicians(s.accessToken, params)
  res.json({ ok: true, ...result })
}

export async function getTechnicianByIdController(req: Request, res: Response) {
  const s = session(req)
  const tech = await repo.getTechnicianById(s.accessToken, param(req, 'id'))
  if (!tech) throw new ApiError(404, 'TECNICO_NO_ENCONTRADO', 'No se encontró el técnico.')
  res.json({ ok: true, datos: tech })
}

export async function updateTechnicianStatusController(req: Request, res: Response) {
  const s = session(req)
  const body = updateTechnicianStatusBody.parse(req.body)
  const updates: { status: string; approved_at?: string } = { status: body.status }
  if (body.status === 'approved') updates.approved_at = new Date().toISOString()
  const { data, error } = await repo.updateTechnicianStatus(s.accessToken, param(req, 'id'), updates)
  if (error || !data) throw new ApiError(400, 'UPDATE_FAILED', 'No se pudo actualizar el técnico.')
  res.json({ ok: true, datos: data })
}

// ── Verifications ──

export async function getVerificationsController(req: Request, res: Response) {
  const s = session(req)
  const params = verificationsQuery.parse(req.query)
  const result = await repo.getVerifications(s.accessToken, params)
  res.json({ ok: true, ...result })
}

export async function createVerificationController(req: Request, res: Response) {
  const s = session(req)
  const body = createVerificationBody.parse(req.body)
  const { data, error } = await repo.createVerification(
    s.accessToken,
    param(req, 'technicianId'),
    s.usuario.id,
    body,
  )
  if (error || !data) throw new ApiError(400, 'VERIFICATION_FAILED', 'No se pudo crear la verificación.')
  res.status(201).json({ ok: true, datos: data })
}

// ── Services ──

export async function getServicesController(req: Request, res: Response) {
  const s = session(req)
  const params = servicesQuery.parse(req.query)
  const result = await repo.getServices(s.accessToken, params)
  res.json({ ok: true, ...result })
}

export async function createServiceController(req: Request, res: Response) {
  const s = session(req)
  const body = createServiceBody.parse(req.body)
  const { data, error } = await repo.createService(s.accessToken, body)
  if (error || !data) throw new ApiError(400, 'CREATE_FAILED', 'No se pudo crear el servicio.')
  res.status(201).json({ ok: true, datos: data })
}

export async function updateServiceController(req: Request, res: Response) {
  const s = session(req)
  const body = updateServiceBody.parse(req.body)
  const { data, error } = await repo.updateService(s.accessToken, param(req, 'id'), body)
  if (error || !data) throw new ApiError(400, 'UPDATE_FAILED', 'No se pudo actualizar el servicio.')
  res.json({ ok: true, datos: data })
}

// ── Categories ──

export async function getCategoriesController(req: Request, res: Response) {
  const s = session(req)
  const categories = await repo.getCategories(s.accessToken)
  res.json({ ok: true, datos: categories })
}

export async function createCategoryController(req: Request, res: Response) {
  const s = session(req)
  const body = createCategoryBody.parse(req.body)
  const { data, error } = await repo.createCategory(s.accessToken, body)
  if (error || !data) throw new ApiError(400, 'CREATE_FAILED', 'No se pudo crear la categoría.')
  res.status(201).json({ ok: true, datos: data })
}

export async function updateCategoryController(req: Request, res: Response) {
  const s = session(req)
  const body = updateCategoryBody.parse(req.body)
  const { data, error } = await repo.updateCategory(s.accessToken, param(req, 'id'), body)
  if (error || !data) throw new ApiError(400, 'UPDATE_FAILED', 'No se pudo actualizar la categoría.')
  res.json({ ok: true, datos: data })
}

// ── Bookings ──

export async function getBookingsController(req: Request, res: Response) {
  const s = session(req)
  const params = bookingsQuery.parse(req.query)
  const result = await repo.getBookings(s.accessToken, params)
  res.json({ ok: true, ...result })
}

export async function getBookingByIdController(req: Request, res: Response) {
  const s = session(req)
  const booking = await repo.getBookingById(s.accessToken, param(req, 'id'))
  if (!booking) throw new ApiError(404, 'RESERVA_NO_ENCONTRADA', 'No se encontró la reserva.')
  res.json({ ok: true, datos: booking })
}

// ── Disputes ──

export async function getDisputesController(req: Request, res: Response) {
  const s = session(req)
  const params = disputesQuery.parse(req.query)
  const result = await repo.getDisputes(s.accessToken, params)
  res.json({ ok: true, ...result })
}

export async function getDisputeByIdController(req: Request, res: Response) {
  const s = session(req)
  const dispute = await repo.getDisputeById(s.accessToken, param(req, 'id'))
  if (!dispute) throw new ApiError(404, 'DISPUTA_NO_ENCONTRADA', 'No se encontró la disputa.')
  res.json({ ok: true, datos: dispute })
}

export async function resolveDisputeController(req: Request, res: Response) {
  const s = session(req)
  const body = resolveDisputeBody.parse(req.body)
  const { data, error } = await repo.resolveDispute(s.accessToken, param(req, 'id'), s.usuario.id, body)
  if (error || !data) throw new ApiError(400, 'RESOLVE_FAILED', 'No se pudo resolver la disputa.')
  res.json({ ok: true, datos: data })
}

// ── Audit Logs ──

export async function getAuditLogsController(req: Request, res: Response) {
  const s = session(req)
  const params = auditLogsQuery.parse(req.query)
  const result = await repo.getAuditLogs(s.accessToken, params)
  res.json({ ok: true, ...result })
}
