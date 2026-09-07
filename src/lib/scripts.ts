import { supabase } from './supabase'

export interface AffirmationScript {
  id: string
  user_id: string
  goal_id: string
  title: string
  script_text: string
  created_at: string
}

export interface GeneratedScript {
  title: string
  script: string
}

export async function listScriptsByGoal(goalId: string) {
  const { data, error } = await supabase
    .from('affirmation_scripts')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AffirmationScript[]
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

export async function deleteScript(scriptId: string) {
  const { error } = await supabase.from('affirmation_scripts').delete().eq('id', scriptId)
  if (error) throw error
}

const GENERATE_TIMEOUT_MS = 30000

export async function generateAffirmationScript(
  goalText: string,
  dimensionLabel: string,
  category: string | null,
): Promise<GeneratedScript> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)

  try {
    const response = await fetch('/api/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalText, dimensionLabel, category }),
      signal: controller.signal,
    })

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
