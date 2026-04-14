import type { RequestHandler } from 'express'

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    ok: false,
    error: {
      codigo: 'RUTA_NO_ENCONTRADA',
      mensaje: 'La ruta solicitada no existe.',
    },
  })
}
