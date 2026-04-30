import { Router } from 'express'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { requireAdminSession } from '../admin-auth/admin-auth.middleware.js'
import {
  getDashboardStatsController,
  getUsersController,
  getUserByIdController,
  updateUserController,
  getTechniciansController,
  getTechnicianByIdController,
  updateTechnicianStatusController,
  getVerificationsController,
  createVerificationController,
  getServicesController,
  createServiceController,
  updateServiceController,
  getCategoriesController,
  createCategoryController,
  updateCategoryController,
  getBookingsController,
  getBookingByIdController,
  getDisputesController,
  getDisputeByIdController,
  resolveDisputeController,
  getAuditLogsController,
} from './admin-data.controller.js'

export const adminDataRouter = Router()

// All routes require an active admin session
adminDataRouter.use(requireAdminSession)

// Dashboard
adminDataRouter.get('/dashboard/stats', asyncHandler(getDashboardStatsController))

// Users
adminDataRouter.get('/users', asyncHandler(getUsersController))
adminDataRouter.get('/users/:id', asyncHandler(getUserByIdController))
adminDataRouter.patch('/users/:id', asyncHandler(updateUserController))

// Technicians
adminDataRouter.get('/technicians', asyncHandler(getTechniciansController))
adminDataRouter.get('/technicians/:id', asyncHandler(getTechnicianByIdController))
adminDataRouter.patch('/technicians/:id/status', asyncHandler(updateTechnicianStatusController))

// Verifications
adminDataRouter.get('/verifications', asyncHandler(getVerificationsController))
adminDataRouter.post('/verifications/:technicianId', asyncHandler(createVerificationController))

// Services
adminDataRouter.get('/services', asyncHandler(getServicesController))
adminDataRouter.post('/services', asyncHandler(createServiceController))
adminDataRouter.patch('/services/:id', asyncHandler(updateServiceController))

// Categories
adminDataRouter.get('/categories', asyncHandler(getCategoriesController))
adminDataRouter.post('/categories', asyncHandler(createCategoryController))
adminDataRouter.patch('/categories/:id', asyncHandler(updateCategoryController))

// Bookings
adminDataRouter.get('/bookings', asyncHandler(getBookingsController))
adminDataRouter.get('/bookings/:id', asyncHandler(getBookingByIdController))

// Disputes
adminDataRouter.get('/disputes', asyncHandler(getDisputesController))
adminDataRouter.get('/disputes/:id', asyncHandler(getDisputeByIdController))
adminDataRouter.patch('/disputes/:id/resolve', asyncHandler(resolveDisputeController))

// Audit logs
adminDataRouter.get('/audit-logs', asyncHandler(getAuditLogsController))
