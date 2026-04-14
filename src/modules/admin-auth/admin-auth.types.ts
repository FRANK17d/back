export type AdminUser = {
  id: string
  authUserId: string
  email: string
  nombres: string
  apellidos: string
  nombreCompleto: string
  rol: 'admin'
  activo: boolean
  ultimoIngreso: string | null
}

export type AdminSession = {
  usuario: AdminUser
  accessToken: string
  refreshToken: string | null
  refrescada: boolean
}

export type RequestMeta = {
  ipAddress: string | null
  userAgent: string | null
}

export type ResetPasswordToken = {
  token: string
  expiraEn: string
}
