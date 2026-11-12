import { createClient } from '@supabase/supabase-js'
import { DEMO_EMAIL } from '../src/lib/demo.js'

// Tipos mínimos compatibles con el runtime Node de Vercel, sin depender de @vercel/node.
interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
}

interface ApiResponse {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

// --- Límite contra abuso: ventana fija de 1 minuto por IP, en memoria de la instancia ---
// En serverless cada instancia tiene su propia memoria, así que el límite es "de mejor esfuerzo" (no global).
// Basta aquí porque lo que se protege es el login de la demo; el gasto de IA lo limita la cuota compartida de la demo
// en api/generate-script.ts, que sí vive en la base de datos.
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_TRACKED_IPS = 5_000

const hits = new Map<string, { count: number; resetAt: number }>()

/** Vercel sobrescribe x-forwarded-for con la IP real del cliente, así que el cliente no puede falsearla. */
function clientIp(req: ApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
  const real = req.headers['x-real-ip']
  return first || (Array.isArray(real) ? real[0] : real) || req.socket?.remoteAddress || 'desconocida'
}

/** Cuenta esta llamada y dice si la IP ya superó el límite de la ventana actual. */
function isRateLimited(ip: string, now: number = Date.now()): boolean {
  if (hits.size >= RATE_LIMIT_MAX_TRACKED_IPS) {
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key) // limpia ventanas vencidas
    if (hits.size >= RATE_LIMIT_MAX_TRACKED_IPS) hits.clear() // tope duro de memoria
  }

  const entry = hits.get(ip)
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count += 1
  return entry.count > RATE_LIMIT_MAX
}

const UNAVAILABLE = { error: 'La demo no está disponible por ahora.', reason: 'demo_unavailable' }

/**
 * GET  → ¿está disponible la demo? (200 o 503). No toca la contraseña: el login lo usa para mostrar u ocultar el botón.
 * POST → inicia sesión como usuario demo y devuelve SOLO { access_token, refresh_token }.
 *
 * La contraseña (DEMO_PASSWORD) vive solo en el entorno del servidor: nunca se devuelve ni se registra.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store') // las respuestas llevan tokens: que nada las guarde en caché

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const password = process.env.DEMO_PASSWORD
  if (!password) {
    res.status(503).json(UNAVAILABLE)
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('demo-login: faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en el servidor')
    res.status(503).json(UNAVAILABLE)
    return
  }

  if (req.method === 'GET') {
    res.status(200).json({ available: true })
    return
  }

  if (isRateLimited(clientIp(req))) {
    res.status(429).json({ error: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.', reason: 'rate_limited' })
    return
  }

  // Cliente con la anon key (nunca service_role) y sin guardar la sesión en el servidor.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password })

  if (error || !data.session) {
    // Solo el mensaje y el status de Supabase; jamás la contraseña ni el cuerpo de la petición.
    console.error(`demo-login: no se pudo iniciar sesión como demo (status=${error?.status ?? 'sin sesión'}): ${error?.message ?? ''}`)
    if (error?.status === 429) {
      res.status(429).json({ error: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.', reason: 'rate_limited' })
      return
    }
    res.status(503).json(UNAVAILABLE)
    return
  }

  res.status(200).json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
}
