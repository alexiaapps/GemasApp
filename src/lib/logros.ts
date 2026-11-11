import type { Dimension, Goal } from './areas'
import { listDimensions } from './areas'
import { mondayOfWeek, startOfMonth } from './date'
import { supabase } from './supabase'

export type GemsPeriod = 'week' | 'month' | 'total'

export const GEMS_PERIODS: { value: GemsPeriod; label: string }[] = [
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'total', label: 'Total' },
]

/** Fila de `gems_by_dimension`: siempre una por área (12), con total 0 si no hay gemas. */
export interface DimensionGems {
  dimension_key: string
  label: string
  color_hex: string
  emoji: string
  sort_order: number
  total: number
}

/**
 * Inicio del periodo (p_from) como instante ISO. Se calcula en la hora local del cliente
 * (America/Mexico_City para esta app): lunes 00:00, día 1 a las 00:00, o null para "Total".
 */
export function periodStart(period: GemsPeriod, now: Date = new Date()): string | null {
  if (period === 'week') return mondayOfWeek(now).toISOString()
  if (period === 'month') return startOfMonth(now).toISOString()
  return null
}

export async function getGemsByDimension(period: GemsPeriod): Promise<DimensionGems[]> {
  const { data, error } = await supabase.rpc('gems_by_dimension', { p_from: periodStart(period) })
  if (error) throw error

  const rows = ((data ?? []) as DimensionGems[]).map((row) => ({ ...row, total: Number(row.total) || 0 }))
  return rows.sort((a, b) => a.sort_order - b.sort_order)
}

/** Meta grande completada junto con el área a la que pertenece. */
export interface CompletedGoal extends Goal {
  dimension: Dimension | null
}

/** Fecha de logro de la meta: `completed_at`, o `created_at` como respaldo si no se registró. */
export function achievedAt(goal: Goal): string {
  return goal.completed_at ?? goal.created_at
}

/** Metas grandes con `completed = true`, de la más reciente a la más antigua (por fecha de logro). */
export async function listCompletedGoals(userId: string): Promise<CompletedGoal[]> {
  const [{ data, error }, dimensions] = await Promise.all([
    supabase.from('goals').select('*').eq('user_id', userId).eq('completed', true),
    listDimensions(),
  ])
  if (error) throw error

  const byKey = new Map(dimensions.map((d) => [d.key, d]))
  return ((data ?? []) as Goal[])
    .map((goal) => ({ ...goal, dimension: byKey.get(goal.dimension_key) ?? null }))
    .sort((a, b) => achievedAt(b).localeCompare(achievedAt(a)))
}

/** "10 nov 2026" en español; null si no hay fecha. */
export function formatAchievedDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '')
}
