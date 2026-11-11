import { audioExtensionFor } from './audio'
import { BUCKET, compressImage } from './media'
import { supabase } from './supabase'

export interface AffirmationScript {
  id: string
  user_id: string
  goal_id: string
  title: string
  script_text: string
  audio_storage_path: string | null
  audio_duration_sec: number | null
  cover_image_path: string | null
  created_at: string
}

export interface AffirmationScriptGoal {
  id: string
  text: string
  dimension_key: string
  dimension: { label: string; emoji: string } | null
}

export interface AffirmationScriptWithGoal extends AffirmationScript {
  goal: AffirmationScriptGoal | null
}

export interface GeneratedScript {
  title: string
  script: string
}

const SCRIPT_WITH_GOAL_SELECT = `
  *,
  goal:goals ( id, text, dimension_key, dimension:dimensions ( label, emoji ) )
`

// Variante con !inner: necesaria para poder filtrar por una columna del recurso embebido (goal.dimension_key).
const SCRIPT_WITH_GOAL_INNER_SELECT = `
  *,
  goal:goals!inner ( id, text, dimension_key, dimension:dimensions ( label, emoji ) )
`

export async function listAllScriptsForUser(userId: string) {
  const { data, error } = await supabase
    .from('affirmation_scripts')
    .select(SCRIPT_WITH_GOAL_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as AffirmationScriptWithGoal[]
}

/** Todos los guiones cuya meta grande pertenece a esta área (dimension_key). */
export async function listScriptsForDimension(userId: string, dimensionKey: string) {
  const { data, error } = await supabase
    .from('affirmation_scripts')
    .select(SCRIPT_WITH_GOAL_INNER_SELECT)
    .eq('user_id', userId)
    .eq('goal.dimension_key', dimensionKey)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as AffirmationScriptWithGoal[]
}

export async function listScriptsForGoal(userId: string, goalId: string) {
  const { data, error } = await supabase
    .from('affirmation_scripts')
    .select(SCRIPT_WITH_GOAL_SELECT)
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as AffirmationScriptWithGoal[]
}

export async function saveScript(userId: string, goalId: string, title: string, scriptText: string) {
  const { data, error } = await supabase
    .from('affirmation_scripts')
    .insert({ user_id: userId, goal_id: goalId, title, script_text: scriptText })
    .select()
    .single()

  if (error) throw error
  return data as AffirmationScript
}

export async function deleteScript(script: AffirmationScript) {
  if (script.audio_storage_path) {
    await supabase.storage.from(BUCKET).remove([script.audio_storage_path])
  }

  const { error } = await supabase.from('affirmation_scripts').delete().eq('id', script.id)
  if (error) throw error
}

export async function uploadScriptAudio(
  userId: string,
  script: AffirmationScript,
  blob: Blob,
  mimeType: string,
  durationSec: number,
) {
  const path = `${userId}/scripts/${script.id}.${audioExtensionFor(mimeType)}`

  if (script.audio_storage_path && script.audio_storage_path !== path) {
    await supabase.storage.from(BUCKET).remove([script.audio_storage_path])
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mimeType, upsert: true })
  if (uploadError) throw uploadError

  const { error: dbError } = await supabase
    .from('affirmation_scripts')
    .update({ audio_storage_path: path, audio_duration_sec: durationSec })
    .eq('id', script.id)
  if (dbError) throw dbError

  return path
}

export async function uploadScriptCover(userId: string, script: AffirmationScript, file: File) {
  const blob = await compressImage(file)
  const path = `${userId}/scripts/${script.id}/cover.jpg`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) throw uploadError

  const { error: dbError } = await supabase
    .from('affirmation_scripts')
    .update({ cover_image_path: path })
    .eq('id', script.id)
  if (dbError) throw dbError

  return path
}

// Mayor que el timeout de Anthropic en el servidor (55 s): un guion completo tarda en generarse.
const GENERATE_TIMEOUT_MS = 60000

/** Mismo tope que valida el servidor (api/generate-script.ts); los inputs de meta lo usan como maxLength. */
export const MAX_GOAL_TEXT_LENGTH = 200

const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Inicia sesión de nuevo para generar afirmaciones.'

export async function generateAffirmationScript(
  goalText: string,
  dimensionLabel: string,
  category: string | null,
): Promise<GeneratedScript> {
  // El endpoint exige una sesión válida: se manda el access_token (getSession lo renueva si ya expiró).
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error(SESSION_EXPIRED_MESSAGE)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)

  try {
    const response = await fetch('/api/generate-script', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ goalText, dimensionLabel, category }),
      signal: controller.signal,
    })

    // El servidor rechazó la sesión: se cierra, y la app (sin sesión) vuelve sola a la pantalla de login.
    if (response.status === 401) {
      await supabase.auth.signOut()
      throw new Error(SESSION_EXPIRED_MESSAGE)
    }

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(data?.error ?? 'No se pudo generar el guion')
    }
    if (!data?.title || !data?.script) {
      throw new Error('Respuesta inválida del servidor')
    }

    return { title: data.title, script: data.script }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('La generación está tardando demasiado. Intenta de nuevo.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
