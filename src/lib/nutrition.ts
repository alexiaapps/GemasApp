import { supabase } from './supabase'

export { toISODate, todayISO } from './date'

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

export async function getNutritionRange(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('nutrition_daily')
    .select('*')
    .eq('user_id', userId)
    .gte('log_date', startDate)
    .lte('log_date', endDate)
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
