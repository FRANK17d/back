import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { ApiError } from './api-error.js'

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: {
        codigo: 'VALIDACION_INVALIDA',
        mensaje: 'La solicitud no es válida.',
        detalles: error.flatten(),
      },
    })
    return
  }

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      ok: false,
      error: {
        codigo: error.code,
        mensaje: error.message,
        detalles: error.details,
      },
    })
    return
  }

  console.error(error)

  res.status(500).json({
    ok: false,
    error: {
      codigo: 'ERROR_INTERNO',
      mensaje: 'Ocurrió un error interno en el servidor.',
    },
  })
}
