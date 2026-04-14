import { z } from 'zod'

const correoSchema = z.string().trim().email('Ingresa un correo válido.').transform((value) => value.toLowerCase())

export const iniciarSesionAdminSchema = z.object({
  correo: correoSchema,
  contrasena: z.string().min(1, 'La contraseña es obligatoria.'),
})

export const solicitarRestablecimientoSchema = z.object({
  correo: correoSchema,
})

export const verificarCodigoRestablecimientoSchema = z.object({
  correo: correoSchema,
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'El código debe tener 6 dígitos.'),
})

export const restablecerContrasenaSchema = z.object({
  token: z.string().trim().min(1, 'El token es obligatorio.'),
  nuevaContrasena: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres.'),
})
