import { supabase } from './supabase'

export { toISODate, todayISO } from './date'
import { toISODate } from './date'

export interface NutritionDaily {
  id?: string
  user_id: string
  log_date: string
  protein_goal_met: boolean
  steps_goal_met: boolean
  km_run: number | null
  weight: number | null
}

export async function getNutritionDay(userId: string, logDate: string) {
  const { data, error } = await supabase
    .from('nutrition_daily')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .maybeSingle()

  if (error) throw error
  return data as NutritionDaily | null
}

export async function getLastNDays(userId: string, days: number) {
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))

  const { data, error } = await supabase
    .from('nutrition_daily')
    .select('*')
    .eq('user_id', userId)
    .gte('log_date', toISODate(start))
    .order('log_date', { ascending: false })

  if (error) throw error
  return (data ?? []) as NutritionDaily[]
}

export async function upsertNutritionField(
  userId: string,
  logDate: string,
  fields: Partial<Omit<NutritionDaily, 'user_id' | 'log_date' | 'id'>>,
) {
  const { error } = await supabase
    .from('nutrition_daily')
    .upsert({ user_id: userId, log_date: logDate, ...fields }, { onConflict: 'user_id,log_date' })

  if (error) throw error
}
