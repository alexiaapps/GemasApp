import type { Subgoal } from './areas'
import { todayISO } from './date'
import { awardGemOnce } from './gems'
import { supabase } from './supabase'

export interface SubgoalCheckin {
  id: string
  user_id: string
  subgoal_id: string
  log_date: string
  created_at: string
}

export async function listCheckinsForSubgoals(subgoalIds: string[], startDate: string, endDate: string) {
  if (subgoalIds.length === 0) return []

  const { data, error } = await supabase
    .from('subgoal_checkins')
    .select('*')
    .in('subgoal_id', subgoalIds)
    .gte('log_date', startDate)
    .lte('log_date', endDate)

  if (error) throw error
  return (data ?? []) as SubgoalCheckin[]
}

/** Agrupa check-ins por subgoal_id, cada uno como un Set de fechas ISO. */
export function groupCheckinsBySubgoal(checkins: SubgoalCheckin[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const c of checkins) {
    const set = map.get(c.subgoal_id) ?? new Set<string>()
    set.add(c.log_date)
    map.set(c.subgoal_id, set)
  }
  return map
}

async function addCheckin(userId: string, subgoalId: string, logDate: string) {
  const { error } = await supabase
    .from('subgoal_checkins')
    .insert({ user_id: userId, subgoal_id: subgoalId, log_date: logDate })

  if (error) throw error
}

async function removeCheckin(subgoalId: string, logDate: string) {
  const { error } = await supabase
    .from('subgoal_checkins')
    .delete()
    .eq('subgoal_id', subgoalId)
    .eq('log_date', logDate)

  if (error) throw error
}

/**
 * Alterna el check-in de HOY para una submeta tipo 'habit'.
 * Marcar un día NO otorga gemas por sí solo, solo registra el progreso visual.
 * Si con este check-in se alcanza target_days_per_week: marca la submeta completada y otorga
 * el bono (source='subgoal', una sola vez en la vida de la submeta gracias a awardGemOnce).
 * Al quitar el check-in de hoy: solo borra la fila, sin revertir gemas ya otorgadas.
 */
export async function toggleHabitCheckinToday(
  subgoal: Subgoal,
  parentDimensionKey: string,
  hasCheckinToday: boolean,
  weekCheckinsCountBeforeToggle: number,
) {
  const today = todayISO()

  if (hasCheckinToday) {
    await removeCheckin(subgoal.id, today)
    return
  }

  await addCheckin(subgoal.user_id, subgoal.id, today)

  const newCount = weekCheckinsCountBeforeToggle + 1
  if (subgoal.target_days_per_week != null && newCount >= subgoal.target_days_per_week) {
    const { error } = await supabase
      .from('subgoals')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', subgoal.id)
    if (error) throw error

    await awardGemOnce(subgoal.user_id, subgoal.gems_reward, parentDimensionKey, 'subgoal', subgoal.id)
  }
}
