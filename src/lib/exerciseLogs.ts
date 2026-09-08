import { todayISO } from './date'
import { supabase } from './supabase'
import { toKg, type WeightUnit } from './units'

export interface ExerciseLog {
  id: string
  user_id: string
  program_id: string | null
  program_day_id: string | null
  exercise_id: string
  set_number: number
  reps: number | null
  duration_sec: number | null
  weight: number | null
  weight_unit: WeightUnit | null
  assistance: number | null
  rir: number | null
  notes: string | null
  log_date: string
  created_at: string
}

export interface SetInput {
  reps: number | null
  durationSec: number | null
  weight: number | null
  weightUnit: WeightUnit | null
  rir: number | null
  notes: string | null
}

export async function getLogsForProgramDay(programDayId: string) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('program_day_id', programDayId)

  if (error) throw error
  return (data ?? []) as ExerciseLog[]
}

/** El log más reciente para ese ejercicio+número de set, de cualquier sesión anterior. */
export async function getMostRecentLogForSet(userId: string, exerciseId: string, setNumber: number) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .eq('set_number', setNumber)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as ExerciseLog | null
}

export function compareSetProgress(
  exerciseType: 'reps' | 'time',
  previous: ExerciseLog | null,
  current: SetInput,
): string | null {
  if (!previous) return null

  const prevWeightKg = toKg(previous.weight, previous.weight_unit)
  const currWeightKg = toKg(current.weight, current.weightUnit)
  const weightIncreased = prevWeightKg != null && currWeightKg != null && currWeightKg > prevWeightKg
  const weightEqual = prevWeightKg != null && currWeightKg != null && currWeightKg === prevWeightKg

  if (weightIncreased) return '↑ subiste peso'

  const prevPrimary = exerciseType === 'reps' ? previous.reps : previous.duration_sec
  const currPrimary = exerciseType === 'reps' ? current.reps : current.durationSec
  const primaryIncreased = prevPrimary != null && currPrimary != null && currPrimary > prevPrimary
  const primaryEqual = prevPrimary != null && currPrimary != null && currPrimary === prevPrimary

  if (primaryIncreased) return exerciseType === 'reps' ? '↑ subiste reps' : '↑ más tiempo'

  if (weightEqual && primaryEqual) return '= igual'

  return null
}

export async function logSet(
  userId: string,
  programId: string,
  programDayId: string,
  exerciseId: string,
  setNumber: number,
  input: SetInput,
) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .insert({
      user_id: userId,
      program_id: programId,
      program_day_id: programDayId,
      exercise_id: exerciseId,
      set_number: setNumber,
      reps: input.reps,
      duration_sec: input.durationSec,
      weight: input.weight,
      weight_unit: input.weightUnit,
      rir: input.rir,
      notes: input.notes,
      log_date: todayISO(),
    })
    .select()
    .single()

  if (error) throw error
  return data as ExerciseLog
}

export interface ExerciseLogWithExercise extends ExerciseLog {
  exercise: { name: string; default_type: 'reps' | 'time' } | null
}

export async function listAllLogsForUser(userId: string) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('*, exercise:exercises ( name, default_type )')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as ExerciseLogWithExercise[]
}
