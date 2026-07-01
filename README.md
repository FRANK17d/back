# TOKE+ Backend

API Express/Node.js de TOKE+ para procesos server-side que no deben vivir en el cliente: Mercado Pago, IA alternativa, notificaciones, validacion de origen, rate limiting y health checks operativos.

## Estado Del Proyecto

- Runtime: Node.js con TypeScript ESM.
- Framework: Express `5.2.x`.
- Produccion: `https://tokeplus-api-439t8drp-fdd3e7290e72.herokuapp.com`.
- BaaS: InsForge `https://439t8drp.us-east.insforge.app`.
- Estado actual verificado: `npm run build` OK y `npm test` OK.

## Stack

- Express 5.
- TypeScript.
- Zod para validacion.
- Pino/Pino HTTP para logging.
- InsForge SDK como cliente admin.
- OpenAI SDK compatible con OpenRouter.
- Mercado Pago REST API.
- Vitest y Supertest para pruebas.

## Endpoints

### Health

```http
GET /health
```

Verifica DB, latencia, configuracion de Mercado Pago, IA y uptime.

### IA

Rutas con rate limit de 20 requests/min por IP.

```http
POST /api/ai/suggest-category
POST /api/ai/analyze-document
POST /api/ai/moderate-request
POST /api/ai/support
```

Usos:

- Sugerir categoria de pedido.
- Analizar documentos de verificacion.
- Moderar solicitudes.
- Responder soporte.

### Pagos

Rutas con rate limit de 10 requests/min por IP.

```http
POST /api/payments/credits/checkout
POST /api/payments/tokepro/checkout
POST /api/payments/mercadopago/webhook
GET  /api/payments/mercadopago/return
```

Usos:

- Crear checkout de creditos.
- Crear preapproval de TokePro.
- Recibir webhooks de Mercado Pago.
- Redirigir al deep link mobile de resultado de pago.

### Notificaciones

```http
POST /api/notifications/process
```

Procesa notificaciones pendientes desde un origen confiable o proceso programado.

## Estructura

```text
src/
  app.ts                         Express app, middleware, rutas y health
  index.ts                       Boot HTTP
  config/env.ts                  Variables de entorno tipadas
  infrastructure/
    insforge/client.ts           Cliente admin InsForge
    logger.ts                    Logger Pino
  modules/
    ai/                          Rutas y servicio IA
    notifications/               Procesador y plantillas
    payments/                    Mercado Pago checkout/webhook/return
  shared/
    http/                        Errores, response helpers, rate limit
    validation/                  Helpers Zod
tests/                           Vitest + Supertest
```

## Variables De Entorno

No commitear valores reales. Usar `.env` local y config vars en Heroku.

```env
NODE_ENV=development
PORT=4000
APP_ORIGIN=http://localhost:3000
INSFORGE_URL=https://439t8drp.us-east.insforge.app
INSFORGE_ANON_KEY=<anon-key>
INSFORGE_API_KEY=<admin-api-key>
PUBLIC_API_URL=http://localhost:4000
PAYMENT_SUCCESS_URL=tokeplus://payments/mercadopago/success
PAYMENT_FAILURE_URL=tokeplus://payments/mercadopago/failure
PAYMENT_PENDING_URL=tokeplus://payments/mercadopago/pending
MERCADOPAGO_ACCESS_TOKEN=<mp-access-token>
MERCADOPAGO_USE_SANDBOX=false
MERCADOPAGO_WEBHOOK_SECRET=<webhook-secret>
OPENROUTER_API_KEY=<openrouter-key>
```

## Desarrollo Local

```bash
npm install
npm run dev
```

## Comandos De Calidad

```bash
npm run build
npm test
```

## Seguridad

- CORS restringido a `APP_ORIGIN` para web; mobile permitido sin Origin.
- `/api/admin` protegido por `requireTrustedOrigin`.
- Rate limiting por IP en IA y pagos.
- Webhooks de Mercado Pago con secreto de firma.
- Credenciales y API keys solo por variables de entorno.
- Logs estructurados con Pino.

## Produccion

Heroku app: `tokeplus-api-439t8drp`.

URL actual:

```text
https://tokeplus-api-439t8drp-fdd3e7290e72.herokuapp.com
```

Health esperado:

```json
{
  "ok": true,
  "datos": {
    "servicio": "backend-toke",
    "db": "ok",
    "mercadopago": "configurado",
    "ai": "configurado"
  }
}
```

## Pruebas Verificadas

- `npm run build`: OK.
- `npm test`: `26/26` tests OK.
- Produccion `/health`: `200`.
- Produccion `/api/ai/suggest-category`: `200`.
- Produccion Mercado Pago return: `302` a deep link `tokeplus://...`.
- Registro real InsForge disparo email de verificacion via SMTP.
