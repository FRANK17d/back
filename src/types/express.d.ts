import type { AdminSession } from '../modules/admin-auth/admin-auth.types.js'

declare global {
  namespace Express {
    interface Request {
      adminSession?: AdminSession
    }
  }
}

export {}
