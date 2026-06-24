import { env } from './config/env.js'
import { createApp } from './app.js'
import { logger } from './infrastructure/logger.js'

const app = createApp()

const server = app.listen(env.port, () => {
  logger.info({ port: env.port }, 'Backend TOKE+ iniciado')
})

// ── Graceful shutdown ──
function shutdown(signal: string) {
  logger.info({ signal }, 'Apagado graceful iniciado')
  server.close(() => {
    logger.info('Servidor HTTP cerrado')
    process.exit(0)
  })
  // Force exit after 10s if connections don't close
  setTimeout(() => {
    logger.warn('Forzando cierre después de timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
