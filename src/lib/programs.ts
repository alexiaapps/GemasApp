import type { Exercise } from './exercises'
import { supabase } from './supabase'

export type ProgramStatus = 'active' | 'archived'

export interface Program {
  id: string
  user_id: string
  name: string
  goal: string | null
  weeks_total: number
  days_per_week: number
  start_date: string | null
  status: ProgramStatus
  created_at: string
}

export interface ProgramWithProgress extends Program {
  completedDays: number
  totalDays: number
}

export interface ProgramDay {
  id: string
  program_id: string
  week: number
  day_number: number
  label: string | null
  completed: boolean
  completed_at: string | null
}

export interface DayExercise {
  id: string
  program_day_id: string
  exercise_id: string
  sets: number
  target_reps: string
  rir: number | null
  rest_seconds: number | null
  order_index: number
  exercise: Exercise | null
}

/** Un ejercicio tal como se diseña dentro de un día, antes de guardarse. */
export interface DayExercisePlan {
  exerciseId: string
  exerciseName: string
  exerciseType: 'reps' | 'time'
  sets: number
  targetReps: string
  rir: number | null
  restSeconds: number | null
}

export interface DayPlan {
  dayNumber: number
  label: string
  exercises: DayExercisePlan[]
}

export interface NewProgramInput {
  name: string
  goal: string
  weeksTotal: number
  daysPerWeek: number
  startDate: string
}

export async function listProgramsWithProgress(userId: string) {
  const { data: programs, error } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', userId)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  const programList = (programs ?? []) as Program[]
  if (programList.length === 0) return [] as ProgramWithProgress[]

  const { data: days, error: daysError } = await supabase
    .from('program_days')
    .select('program_id, completed')
    .in(
      'program_id',
      programList.map((p) => p.id),
    )

  if (daysError) throw daysError

  const progressByProgram = new Map<string, { completed: number; total: number }>()
  for (const day of days ?? []) {
    const entry = progressByProgram.get(day.program_id) ?? { completed: 0, total: 0 }
    entry.total += 1
    if (day.completed) entry.completed += 1
    progressByProgram.set(day.program_id, entry)
  }

  return programList.map((program) => ({
    ...program,
    completedDays: progressByProgram.get(program.id)?.completed ?? 0,
    totalDays: progressByProgram.get(program.id)?.total ?? program.weeks_total * program.days_per_week,
  }))
}

export async function updateProgram(programId: string, fields: { name?: string; goal?: string }) {
  const { error } = await supabase.from('programs').update(fields).eq('id', programId)
  if (error) throw error
}

/** program_days y day_exercises tienen ON DELETE CASCADE desde programs — la base de datos
 * se encarga de limpiarlos. exercise_logs usa ON DELETE SET NULL, así que el historial de
 * entrenamientos reales nunca se borra, solo pierde la referencia al programa/día borrado. */
export async function deleteProgram(programId: string) {
  const { error } = await supabase.from('programs').delete().eq('id', programId)
  if (error) throw error
}

export async function createProgram(userId: string, input: NewProgramInput, weekPlan: DayPlan[]) {
  const { error: archiveError } = await supabase
    .from('programs')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .eq('status', 'active')
  if (archiveError) throw archiveError

  const { data: program, error: programError } = await supabase
    .from('programs')
    .insert({
      user_id: userId,
      name: input.name,
      goal: input.goal,
      weeks_total: input.weeksTotal,
      days_per_week: input.daysPerWeek,
      start_date: input.startDate,
      status: 'active',
    })
    .select()
    .single()
  if (programError) throw programError

  await createProgramDaysForWeeks(program.id, 1, input.weeksTotal, weekPlan)

  return program as Program
}

/** Crea program_days + day_exercises para el rango de semanas [fromWeek, toWeek], clonando weekPlan. */
async function createProgramDaysForWeeks(
  programId: string,
  fromWeek: number,
  toWeek: number,
  weekPlan: DayPlan[],
) {
  const dayRows: { program_id: string; week: number; day_number: number; label: string }[] = []
  for (let week = fromWeek; week <= toWeek; week++) {
    for (const dayPlan of weekPlan) {
      dayRows.push({ program_id: programId, week, day_number: dayPlan.dayNumber, label: dayPlan.label })
    }
  }

  if (dayRows.length === 0) return

  const { data: createdDays, error: daysError } = await supabase
    .from('program_days')
    .insert(dayRows)
    .select()
  if (daysError) throw daysError

  const exerciseRows: {
    program_day_id: string
    exercise_id: string
    sets: number
    target_reps: string
    rir: number | null
    rest_seconds: number | null
    order_index: number
  }[] = []

  for (const day of (createdDays ?? []) as ProgramDay[]) {
    const plan = weekPlan.find((p) => p.dayNumber === day.day_number)
    if (!plan) continue
    plan.exercises.forEach((ex, index) => {
      exerciseRows.push({
        program_day_id: day.id,
        exercise_id: ex.exerciseId,
        sets: ex.sets,
        target_reps: ex.targetReps,
        rir: ex.rir,
        rest_seconds: ex.restSeconds,
        order_index: index,
      })
    })
  }

  if (exerciseRows.length > 0) {
    const { error: exercisesError } = await supabase.from('day_exercises').insert(exerciseRows)
    if (exercisesError) throw exercisesError
  }
}

export async function getProgram(programId: string) {
  const { data, error } = await supabase.from('programs').select('*').eq('id', programId).single()
  if (error) throw error
  return data as Program
}

export async function listProgramDays(programId: string) {
  const { data, error } = await supabase
    .from('program_days')
    .select(
      `id, program_id, week, day_number, label, completed, completed_at,
       day_exercises ( id, program_day_id, exercise_id, sets, target_reps, rir, rest_seconds, order_index, exercise:exercises ( id, user_id, name, default_type, dimension_key, created_at ) )`,
    )
    .eq('program_id', programId)
    .order('week', { ascending: true })
    .order('day_number', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as (ProgramDay & { day_exercises: DayExercise[] })[]
}

export async function replaceDayExercises(programDayId: string, exercises: DayExercisePlan[]) {
  const { error: deleteError } = await supabase
    .from('day_exercises')
    .delete()
    .eq('program_day_id', programDayId)
  if (deleteError) throw deleteError

  if (exercises.length === 0) return

  const rows = exercises.map((ex, index) => ({
    program_day_id: programDayId,
    exercise_id: ex.exerciseId,
    sets: ex.sets,
    target_reps: ex.targetReps,
    rir: ex.rir,
    rest_seconds: ex.restSeconds,
    order_index: index,
  }))

  const { error: insertError } = await supabase.from('day_exercises').insert(rows)
  if (insertError) throw insertError
}

/** Clona el Día 1 de la semana 1 como plantilla para una semana nueva, incrementando weeks_total. */
export async function addExtraWeek(program: Program) {
  const { data: week1Days, error } = await supabase
    .from('program_days')
    .select(
      `id, day_number, label,
       day_exercises ( exercise_id, sets, target_reps, rir, rest_seconds, order_index )`,
    )
    .eq('program_id', program.id)
    .eq('week', 1)
    .order('day_number', { ascending: true })

  if (error) throw error

  const weekPlan: DayPlan[] = ((week1Days ?? []) as unknown as (ProgramDay & { day_exercises: DayExercise[] })[]).map(
    (day) => ({
      dayNumber: day.day_number,
      label: day.label ?? '',
      exercises: day.day_exercises
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((ex) => ({
          exerciseId: ex.exercise_id,
          exerciseName: '',
          exerciseType: 'reps',
          sets: ex.sets,
          targetReps: ex.target_reps,
          rir: ex.rir,
          restSeconds: ex.rest_seconds,
        })),
    }),
  )

  const newWeekNumber = program.weeks_total + 1
  await createProgramDaysForWeeks(program.id, newWeekNumber, newWeekNumber, weekPlan)

  const { error: updateError } = await supabase
    .from('programs')
    .update({ weeks_total: newWeekNumber })
    .eq('id', program.id)
  if (updateError) throw updateError
}

export async function getProgramDay(programDayId: string) {
  const { data, error } = await supabase
    .from('program_days')
    .select(
      `id, program_id, week, day_number, label, completed, completed_at,
       day_exercises ( id, program_day_id, exercise_id, sets, target_reps, rir, rest_seconds, order_index, exercise:exercises ( id, user_id, name, default_type, dimension_key, created_at ) )`,
    )
    .eq('id', programDayId)
    .single()

  if (error) throw error
  return data as unknown as ProgramDay & { day_exercises: DayExercise[] }
}

export async function markDayCompleted(programDayId: string) {
  const { error } = await supabase
    .from('program_days')
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq('id', programDayId)
  if (error) throw error
}

export async function isWeekFullyCompleted(programId: string, week: number) {
  const { data, error } = await supabase
    .from('program_days')
    .select('completed')
    .eq('program_id', programId)
    .eq('week', week)

  if (error) throw error
  const rows = data ?? []
  return rows.length > 0 && rows.every((d) => d.completed)
}
