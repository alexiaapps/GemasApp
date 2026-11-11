import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// Tipos mínimos compatibles con el runtime Node de Vercel, sin depender de @vercel/node.
interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body: unknown
}

interface ApiResponse {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
}

interface GenerateScriptBody {
  dimensionLabel?: string
  goalText?: string
  // Aceptado por compatibilidad con el frontend; el prompt actual no tiene un lugar definido para insertarlo.
  category?: string | null
}

const MODEL = 'claude-sonnet-5-5'
const MAX_TOKENS = 1200 // ~450 palabras en español son ~900 tokens, más la envoltura JSON
const ANTHROPIC_TIMEOUT_MS = 25_000
const ANTHROPIC_MAX_RETRIES = 1

// Topes de entrada: todo lo que llega del cliente termina dentro del prompt.
const MAX_GOAL_TEXT_LENGTH = 200
const MAX_DIMENSION_LABEL_LENGTH = 50

/** Token de `Authorization: Bearer <token>`, o null si el header falta o no tiene ese formato. */
function getBearerToken(req: ApiRequest): string | null {
  const header = req.headers?.authorization
  const value = Array.isArray(header) ? header[0] : header
  const match = typeof value === 'string' ? /^Bearer\s+(\S+)$/i.exec(value.trim()) : null
  return match ? match[1] : null
}

type AuthResult = { ok: true } | { ok: false; status: 401 | 503; error: string }

/**
 * Valida el access_token contra Supabase (auth.getUser). Usa un cliente con la anon key, nunca service_role:
 * getUser(token) no necesita privilegios, solo que Supabase confirme que el token es válido y vigente.
 */
async function verifySession(token: string): Promise<AuthResult> {
  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    // Supabase caído o inalcanzable: no es culpa del token, no se le dice al cliente que cierre sesión.
    const unavailable = error?.name === 'AuthRetryableFetchError' || (error?.status ?? 0) >= 500
    if (unavailable) return { ok: false, status: 503, error: 'No se pudo verificar la sesión. Intenta de nuevo.' }
    return { ok: false, status: 401, error: 'Sesión inválida o expirada' }
  }

  return { ok: true }
}

/** Reemplaza por espacios los saltos de línea, tabs y demás caracteres de control. */
function replaceControlChars(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    out += code <= 0x1f || code === 0x7f || code === 0x2028 || code === 0x2029 ? ' ' : ch
  }
  return out
}

/** Texto de usuario → una sola línea sin comillas ni caracteres de control, seguro para ir entre comillas en el prompt. */
function sanitizeForPrompt(text: string): string {
  return replaceControlChars(text)
    .replace(/["'`\u00ab\u00bb\u2018\u2019\u201a\u201b\u201c\u201d\u201e\u201f]/g, '') // comillas de todo tipo
    .replace(/\s+/g, ' ')
    .trim()
}

type FieldResult = { ok: true; value: string } | { ok: false; error: string }

function readTextField(raw: unknown, name: string, maxLength: number): FieldResult {
  if (typeof raw !== 'string') return { ok: false, error: `${name} debe ser un texto` }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: `${name} no puede estar vacío` }
  if (trimmed.length > maxLength) return { ok: false, error: `${name} no puede superar ${maxLength} caracteres` }
  const clean = sanitizeForPrompt(trimmed)
  if (!clean) return { ok: false, error: `${name} no puede estar vacío` }
  return { ok: true, value: clean }
}

function buildPrompt(dimensionLabel: string, goalText: string): string {
  return `Eres un escritor especializado en visualizaciones de manifestación muy específicas y sensoriales (NO motivacionales genéricas). Dada esta meta: '${goalText}' (área: ${dimensionLabel}), escribe UNA escena (220-450 palabras — este guion se leerá en voz alta y debe durar entre 1:30 y 3 minutos) narrada en primera persona, tiempo PRESENTE, como si la persona ya estuviera viviendo el resultado de haber logrado esa meta.

Debe incluir:
- Una situación concreta y específica (un momento, un lugar, gente presente)
- Detalle sensorial (qué ve, qué escucha, qué huele, qué siente en el cuerpo)
- Sus PENSAMIENTOS internos en ese momento (breves reflexiones, lo que se dice a sí misma)
- La EMOCIÓN que siente y cómo la experimenta (dónde la siente en el cuerpo, cómo se manifiesta)

Evita frases genéricas de superación personal. Escribe con ritmo pausado y contemplativo, apto para leerse en voz alta como una meditación guiada — usa pausas naturales (oraciones cortas intercaladas con algunas más largas).

Ejemplo de tono (para una meta de carrera musical): 'Estoy sentada en el sillón de mi sala nueva. Mi mejor amiga acaba de llegar con vino para celebrar, y en la pantalla del laptop se ve el contador de reproducciones subiendo mientras suena mi canción de fondo. Siento un nudo cálido en el pecho, esa mezcla de orgullo e incredulidad. Pienso: lo logré, de verdad lo logré...' (y continúa desarrollando la escena con este nivel de profundidad durante todo el guion)

Responde ÚNICAMENTE con este JSON, sin texto adicional ni markdown:
{"title": "Título de 3-6 palabras que resuma la escena", "script": "el texto completo de la escena"}`
}

function extractJson(text: string): { title: string; script: string } | null {
  // Por si el modelo igual envuelve la respuesta en ```json ... ``` a pesar de la instrucción.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')

  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed.title === 'string' && typeof parsed.script === 'string') {
      return { title: parsed.title, script: parsed.script }
    }
    return null
  } catch {
    return null
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // ANTHROPIC_API_KEY vive solo en el entorno del servidor (Vercel), nunca en el bundle del navegador.
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en el entorno del servidor' })
    return
  }
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    res.status(500).json({ error: 'Falta configurar VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en el servidor' })
    return
  }

  // 1) Sesión: se valida ANTES de leer el body y de cualquier llamada a Anthropic.
  const token = getBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Falta iniciar sesión' })
    return
  }

  const auth = await verifySession(token)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  // 2) Entrada: tipos, topes y limpieza del texto que va al prompt.
  const body = typeof req.body === 'object' && req.body !== null ? (req.body as GenerateScriptBody) : {}

  const goal = readTextField(body.goalText, 'goalText', MAX_GOAL_TEXT_LENGTH)
  if (!goal.ok) {
    res.status(400).json({ error: goal.error })
    return
  }

  const dimension = readTextField(body.dimensionLabel, 'dimensionLabel', MAX_DIMENSION_LABEL_LENGTH)
  if (!dimension.ok) {
    res.status(400).json({ error: dimension.error })
    return
  }

  try {
    const client = new Anthropic({ timeout: ANTHROPIC_TIMEOUT_MS, maxRetries: ANTHROPIC_MAX_RETRIES })

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Sin `thinking`: claude-sonnet-5-5 no razona antes de responder y la API rechaza { type: 'disabled' }.
      messages: [{ role: 'user', content: buildPrompt(dimension.value, goal.value) }],
    })

    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    )

    const parsed = textBlock ? extractJson(textBlock.text) : null

    if (!parsed) {
      console.error('generate-script: respuesta no era el JSON esperado:', textBlock?.text)
      res.status(502).json({ error: 'El modelo no devolvió un formato válido' })
      return
    }

    res.status(200).json(parsed)
  } catch (err) {
    // Una línea legible en los Runtime Logs (el plan Hobby solo guarda 30 min). Al cliente solo va el texto genérico.
    if (err instanceof Anthropic.APIError) {
      console.error(`generate-script: Anthropic respondió ${err.status} (${err.type ?? 'sin tipo'}): ${err.message} [request_id=${err.requestID}]`)
    } else {
      console.error('generate-script error:', err)
    }
    res.status(500).json({ error: 'No se pudo generar el guion' })
  }
}
