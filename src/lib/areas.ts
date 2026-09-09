import { awardGemOnce } from './gems'
import { supabase } from './supabase'

export interface Dimension {
  key: string
  label: string
  color_hex: string
  emoji: string
  sort_order: number
}

export interface Goal {
  id: string
  user_id: string
  text: string
  category: string | null
  dimension_key: string
  completed: boolean
  completed_at: string | null
  gems_reward: number
  created_at: string
  icon_emoji: string | null
}

export type GoalKind = 'once' | 'habit'

export interface Subgoal {
  id: string
  user_id: string
  goal_id: string
  text: string
  gems_reward: number
  completed: boolean
  completed_at: string | null
  created_at: string
  week_start_date: string | null
  goal_kind: GoalKind
  target_days_per_week: number | null
}

export async function listDimensions() {
  const { data, error } = await supabase
    .from('dimensions')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as Dimension[]
}

export async function getDimension(key: string) {
  const { data, error } = await supabase
    .from('dimensions')
    .select('*')
    .eq('key', key)
    .maybeSingle()

  if (error) throw error
  return data as Dimension | null
}

export async function listGoalsByDimension(userId: string, dimensionKey: string) {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension_key', dimensionKey)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Goal[]
}

export async function createGoal(
  userId: string,
  dimensionKey: string,
  text: string,
  category: string,
  gemsReward: number,
  iconEmoji: string | null = null,
) {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      dimension_key: dimensionKey,
      text,
      category,
      gems_reward: gemsReward,
      icon_emoji: iconEmoji,
    })
    .select()
    .single()

  if (error) throw error
  return data as Goal
}

export async function completeGoal(goal: Goal) {
  const { error: updateError } = await supabase
    .from('goals')
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq('id', goal.id)

  if (updateError) throw updateError

  await awardGemOnce(goal.user_id, goal.gems_reward, goal.dimension_key, 'goal', goal.id)
}

export async function listSubgoalsByGoal(goalId: string) {
  const { data, error } = await supabase
    .from('subgoals')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Subgoal[]
}

export async function createSubgoal(
  userId: string,
  goalId: string,
  text: string,
  gemsReward: number,
  goalKind: GoalKind = 'once',
  targetDaysPerWeek: number | null = null,
) {
  const { data, error } = await supabase
    .from('subgoals')
    .insert({
      user_id: userId,
      goal_id: goalId,
      text,
      gems_reward: gemsReward,
      goal_kind: goalKind,
      target_days_per_week: goalKind === 'habit' ? targetDaysPerWeek : null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Subgoal
}

/** Marca o desmarca una submeta. Las gemas solo se otorgan una vez, al pasar a completada. */
export async function setSubgoalCompleted(
  subgoal: Subgoal,
  completed: boolean,
  parentDimensionKey: string,
) {
  const { error: updateError } = await supabase
    .from('subgoals')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', subgoal.id)

  if (updateError) throw updateError

  if (completed) {
    await awardGemOnce(subgoal.user_id, subgoal.gems_reward, parentDimensionKey, 'subgoal', subgoal.id)
  }
}

export async function completeSubgoal(subgoal: Subgoal, parentDimensionKey: string) {
  await setSubgoalCompleted(subgoal, true, parentDimensionKey)
}

/** Borra la meta; sus submetas se borran en cascada (ON DELETE CASCADE en la base de datos). */
export async function deleteGoal(goalId: string) {
  const { error } = await supabase.from('goals').delete().eq('id', goalId)
  if (error) throw error
}

export async function deleteSubgoal(subgoalId: string) {
  const { error } = await supabase.from('subgoals').delete().eq('id', subgoalId)
  if (error) throw error
}
