import { supabase } from './supabase'

/** Error con un mensaje ya listo para mostrar al usuario. */
export class DemoError extends Error {
  /** 'unavailable' = la demo no está configurada o no responde: el botón no debe ofrecerse. */
  kind: 'unavailable' | 'failed'

  constructor(message: string, kind: 'unavailable' | 'failed') {
    super(message)
    this.name = 'DemoError'
    this.kind = kind
  }
}

/** ¿Está disponible la demo en este despliegue? Sin DEMO_PASSWORD (o sin /api, como en `npm run dev`) → false. */
export async function isDemoAvailable(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch('/api/demo-login', { signal })
    if (!response.ok) return false
    const data = await response.json().catch(() => null)
    return data?.available === true
  } catch {
    return false
  }
}

/** Pide los tokens de la cuenta demo al servidor (la contraseña nunca llega al navegador). */
async function requestDemoTokens(): Promise<{ access_token: string; refresh_token: string }> {
  let response: Response
  try {
    response = await fetch('/api/demo-login', { method: 'POST' })
  } catch {
    throw new DemoError('No se pudo conectar con la demo. Revisa tu conexión e inténtalo de nuevo.', 'failed')
  }

  const data = await response.json().catch(() => null)

  if (response.status === 503) {
    throw new DemoError('La demo no está disponible por ahora.', 'unavailable')
  }
  if (response.status === 429) {
    throw new DemoError(
      typeof data?.error === 'string' ? data.error : 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
      'failed',
    )
  }
  if (!response.ok || typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string') {
    throw new DemoError('No se pudo iniciar la demo. Inténtalo de nuevo.', 'failed')
  }

  return { access_token: data.access_token, refresh_token: data.refresh_token }
}

/**
 * Entra a la demo: /api/demo-login → setSession → reset_demo_data.
 * Si cualquier paso falla se cierra la sesión (solo en este navegador) y se lanza un DemoError: no se entra a medias.
 */
export async function startDemoSession(): Promise<void> {
  try {
    const tokens = await requestDemoTokens()

    const { error: sessionError } = await supabase.auth.setSession(tokens)
    if (sessionError) throw new DemoError('No se pudo iniciar la sesión de la demo. Inténtalo de nuevo.', 'failed')

    // Borra lo que dejó el visitante anterior y recarga los datos de ejemplo (solo funciona para el usuario demo).
    const { error: resetError } = await supabase.rpc('reset_demo_data')
    if (resetError) throw new DemoError('No se pudieron cargar los datos de ejemplo. Inténtalo de nuevo.', 'failed')
  } catch (err) {
    // scope 'local': la cuenta demo es compartida; un cierre global revocaría la sesión de los demás visitantes.
    await supabase.auth.signOut({ scope: 'local' })
    throw err instanceof DemoError ? err : new DemoError('No se pudo iniciar la demo. Inténtalo de nuevo.', 'failed')
  }
}
