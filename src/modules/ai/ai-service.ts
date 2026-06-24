import OpenAI from 'openai'
import { env } from '../../config/env.js'

// Model Gateway de InsForge = clave de OpenRouter usada directamente contra su
// API compatible con OpenAI (el proxy `insforge.ai.*` está deprecado).
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: env.openrouterApiKey || 'missing',
  defaultHeaders: {
    'HTTP-Referer': env.appOrigin,
    'X-Title': 'TOKE+',
  },
})

// Modelos: barato para texto, con visión para documentos.
const TEXT_MODEL = 'openai/gpt-4o-mini'
const VISION_MODEL = 'anthropic/claude-3.5-sonnet'

export class AiNotConfiguredError extends Error {
  constructor() {
    super('OPENROUTER_API_KEY no está configurado en el backend.')
    this.name = 'AiNotConfiguredError'
  }
}

export function isAiConfigured() {
  return env.openrouterApiKey.length > 0
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

async function chat(messages: Message[], maxTokens = 500): Promise<string> {
  if (!isAiConfigured()) throw new AiNotConfiguredError()
  const completion = await openrouter.chat.completions.create({
    model: TEXT_MODEL,
    messages,
    max_tokens: maxTokens,
  })
  return completion.choices[0]?.message?.content ?? ''
}

function parseJsonLoose<T>(text: string, fallback: T): T {
  try {
    const cleaned = text
      .replace(/```json?\s*/gi, '')
      .replace(/```/g, '')
      .trim()
    return JSON.parse(cleaned) as T
  } catch {
    return fallback
  }
}

// ─── 1. Auto-categorización de pedidos ────────────────────────

export async function suggestCategory(
  description: string,
  categories: { id: string; name: string }[]
): Promise<{ category_id: string; category_name: string; confidence: number }> {
  const categoryList = categories.map((c) => `- ${c.id}: ${c.name}`).join('\n')

  const response = await chat(
    [
      {
        role: 'system',
        content: `Eres un clasificador de servicios del hogar en Trujillo, Perú. Dado la descripción de un pedido, responde SOLO con un JSON con la categoría más adecuada.

Categorías disponibles:
${categoryList}

Responde EXACTAMENTE en este formato JSON (sin markdown, sin explicaciones):
{"category_id": "id", "category_name": "nombre", "confidence": 0.95}

Si no estás seguro, pon confidence < 0.5.`,
      },
      { role: 'user', content: description },
    ],
    150
  )

  return parseJsonLoose(response, {
    category_id: '',
    category_name: '',
    confidence: 0,
  })
}

// ─── 2. Asistencia en verificación de documentos (visión) ─────

export async function analyzeVerificationDocument(
  imageUrl: string,
  documentType: 'dni' | 'certificate' | 'selfie'
): Promise<{ valid: boolean; reason: string; extracted_data: Record<string, string> }> {
  if (!isAiConfigured()) throw new AiNotConfiguredError()

  const prompts: Record<string, string> = {
    dni: `Analiza esta imagen de un DNI peruano. Verifica: 1) ¿Se ve claramente un DNI peruano? 2) ¿Se puede leer el número? 3) ¿Se ve la foto de la persona? 4) ¿Parece auténtico (no editado/borroso)?

Responde SOLO con JSON:
{"valid": true/false, "reason": "explicación corta", "extracted_data": {"dni_number": "...", "full_name": "..."}}`,
    certificate: `Analiza esta imagen de un certificado o documento profesional. Verifica: 1) ¿Acredita una habilidad técnica? 2) ¿Se lee el nombre del titular? 3) ¿Se ve la institución emisora?

Responde SOLO con JSON:
{"valid": true/false, "reason": "explicación corta", "extracted_data": {"institution": "...", "title": "..."}}`,
    selfie: `Analiza esta selfie de verificación. Verifica: 1) ¿Se ve claramente una persona? 2) ¿Buena iluminación? 3) ¿Parece reciente (no una foto de otra foto)?

Responde SOLO con JSON:
{"valid": true/false, "reason": "explicación corta", "extracted_data": {}}`,
  }

  const completion = await openrouter.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompts[documentType] },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 300,
  })

  const text = completion.choices[0]?.message?.content ?? ''
  return parseJsonLoose(text, {
    valid: false,
    reason: 'No se pudo analizar el documento',
    extracted_data: {},
  })
}

// ─── 3. Moderación de pedidos ─────────────────────────────────

export async function moderateRequest(
  title: string,
  description: string
): Promise<{ approve: boolean; reason: string }> {
  const response = await chat(
    [
      {
        role: 'system',
        content: `Eres el moderador de TOKE+, plataforma de servicios del hogar en Trujillo, Perú. Decide si un pedido es apropiado para publicar.

RECHAZA si: es spam/ofensivo/irrelevante; no es un servicio del hogar (electricidad, plomería, limpieza, pintura, cerrajería, etc.); contiene datos sensibles (teléfono, dirección exacta); es venta de productos.
APRUEBA si es una solicitud legítima de servicio del hogar.

Responde SOLO con JSON (sin markdown):
{"approve": true/false, "reason": "explicación corta"}`,
      },
      { role: 'user', content: `Título: ${title}\nDescripción: ${description}` },
    ],
    200
  )

  return parseJsonLoose(response, {
    approve: true,
    reason: 'No se pudo evaluar; aprobado por defecto',
  })
}

// ─── 4. Soporte con IA ─────────────────────────────────────────

export async function supportChat(
  userMessage: string,
  conversationHistory: Message[] = []
): Promise<string> {
  const systemPrompt = `Eres el asistente de soporte de TOKE+, una app que conecta clientes con técnicos de servicios del hogar en Trujillo, Perú.

Información clave:
- Los clientes publican pedidos y los técnicos de la zona postulan.
- Postular cuesta 1 crédito (los técnicos nuevos reciben 7 de regalo).
- El cliente elige al técnico y el pago es directo (efectivo o Yape).
- TOKE+ no cobra comisión al cliente.
- Los técnicos deben verificar su identidad antes de postular.

Responde de forma amable, concisa y en español. Si no sabes algo específico de la cuenta del usuario, sugiérele contactar al equipo humano. No inventes precios ni políticas.`

  return await chat(
    [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ],
    400
  )
}
