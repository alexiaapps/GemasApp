import { supabase } from './supabase'

export type ExerciseType = 'reps' | 'time'

export interface Exercise {
  id: string
  user_id: string
  name: string
  default_type: ExerciseType
  dimension_key: string
  created_at: string
}

export async function searchExercises(userId: string, query: string, limit = 8) {
  let request = supabase.from('exercises').select('*').eq('user_id', userId)

  if (query.trim()) {
    request = request.ilike('name', `%${query.trim()}%`)
  }

  const { data, error } = await request.order('name', { ascending: true }).limit(limit)
  if (error) throw error
  return (data ?? []) as Exercise[]
}

export async function createExercise(userId: string, name: string, defaultType: ExerciseType) {
  const { data, error } = await supabase
    .from('exercises')
    .insert({ user_id: userId, name: name.trim(), default_type: defaultType })
    .select()
    .single()

  if (error) throw error
  return data as Exercise
}

/** Busca un ejercicio existente por nombre exacto (case-insensitive); si no existe, lo crea. */
export async function findOrCreateExercise(userId: string, name: string, defaultType: ExerciseType) {
  const trimmed = name.trim()
  const { data: existing, error: findError } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', trimmed)
    .maybeSingle()

  if (findError) throw findError
  if (existing) return existing as Exercise

  return createExercise(userId, trimmed, defaultType)
}
