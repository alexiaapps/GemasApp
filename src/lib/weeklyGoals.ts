import { supabase } from './supabase'

export const MAX_WEEKLY_GOALS = 5

export interface WeeklySubgoal {
  id: string
  user_id: string
  goal_id: string
  text: string
  gems_reward: number
  completed: boolean
  completed_at: string | null
  created_at: string
  week_start_date: string | null
  goal: {
    id: string
    text: string
    dimension_key: string
    dimension: {
      label: string
      color_hex: string
    } | null
  }
}

export interface AssignableSubgoal {
  id: string
  goal_id: string
  text: string
  gems_reward: number
  goal: {
    id: string
    text: string
    dimension_key: string
    dimension: {
      label: string
      color_hex: string
    } | null
  }
}

export interface GoalOption {
  id: string
  text: string
  dimension_key: string
  dimension: {
    label: string
    emoji: string
    color_hex: string
  } | null
}

const WEEKLY_SUBGOAL_SELECT = `
  id, user_id, goal_id, text, gems_reward, completed, completed_at, created_at, week_start_date,
  goal:goals ( id, text, dimension_key, dimension:dimensions ( label, color_hex ) )
`

export async function listWeeklySubgoals(userId: string, weekStart: string) {
  const { data, error } = await supabase
    .from('subgoals')
    .select(WEEKLY_SUBGOAL_SELECT)
    .eq('user_id', userId)
    .eq('week_start_date', weekStart)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as WeeklySubgoal[]
}

export async function listAssignableSubgoals(userId: string, weekStart: string) {
  const { data, error } = await supabase
    .from('subgoals')
    .select(
      'id, goal_id, text, gems_reward, goal:goals ( id, text, dimension_key, dimension:dimensions ( label, color_hex ) )',
    )
    .eq('user_id', userId)
    .eq('completed', false)
    .or(`week_start_date.is.null,week_start_date.neq.${weekStart}`)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as AssignableSubgoal[]
}

export async function listGoalOptions(userId: string) {
  const { data, error } = await supabase
    .from('goals')
    .select('id, text, dimension_key, dimension:dimensions ( label, emoji, color_hex )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as GoalOption[]
}

export async function assignSubgoalToWeek(subgoalId: string, weekStart: string) {
  const { error } = await supabase
    .from('subgoals')
    .update({ week_start_date: weekStart })
    .eq('id', subgoalId)

  if (error) throw error
}

export async function createSubgoalForWeek(
  userId: string,
  goalId: string,
  text: string,
  gemsReward: number,
  weekStart: string,
) {
  const { error } = await supabase.from('subgoals').insert({
    user_id: userId,
    goal_id: goalId,
    text,
    gems_reward: gemsReward,
    week_start_date: weekStart,
  })

  if (error) throw error
}
