import { Check, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import HabitDotsRow from './HabitDotsRow'
import { deleteSubgoal, setSubgoalCompleted, type GoalKind } from '../lib/areas'
import { currentWeekStartISO, todayISO, weekEndISO } from '../lib/date'
import { groupCheckinsBySubgoal, listCheckinsForSubgoals, toggleHabitCheckinToday } from '../lib/habits'
import {
  MAX_WEEKLY_GOALS,
  assignSubgoalToWeek,
  createSubgoalForWeek,
  listAssignableSubgoals,
  listGoalOptions,
  listWeeklySubgoals,
  type AssignableSubgoal,
  type GoalOption,
  type WeeklySubgoal,
} from '../lib/weeklyGoals'

export default function WeeklyGoalsSection() {
  const { user } = useAuth()
  const weekStart = currentWeekStartISO()

  const [weeklyList, setWeeklyList] = useState<WeeklySubgoal[]>([])
  const [checkinsBySubgoal, setCheckinsBySubgoal] = useState<Map<string, Set<string>>>(new Map())
  const [togglingHabitId, setTogglingHabitId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showPicker, setShowPicker] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [assignable, setAssignable] = useState<AssignableSubgoal[]>([])
  const [goalOptions, setGoalOptions] = useState<GoalOption[]>([])
  const [newGoalKind, setNewGoalKind] = useState<GoalKind>('once')

  async function loadCheckins(list: WeeklySubgoal[]) {
    const habitIds = list.filter((s) => s.goal_kind === 'habit').map((s) => s.id)
    const checkins = await listCheckinsForSubgoals(habitIds, weekStart, weekEndISO(weekStart))
    return groupCheckinsBySubgoal(checkins)
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const list = await listWeeklySubgoals(user!.id, weekStart)
        if (cancelled) return
        setWeeklyList(list)
        const checkinsMap = await loadCheckins(list)
        if (!cancelled) setCheckinsBySubgoal(checkinsMap)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, weekStart])

  async function refreshWeeklyList() {
    if (!user) return
    const list = await listWeeklySubgoals(user.id, weekStart)
    setWeeklyList(list)
    setCheckinsBySubgoal(await loadCheckins(list))
  }

  async function handleToggleHabitToday(item: WeeklySubgoal) {
    if (!user) return
    const today = todayISO()
    const currentSet = checkinsBySubgoal.get(item.id) ?? new Set<string>()
    const hasToday = currentSet.has(today)

    setTogglingHabitId(item.id)
    setCheckinsBySubgoal((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(item.id) ?? [])
      if (hasToday) set.delete(today)
      else set.add(today)
      next.set(item.id, set)
      return next
    })

    try {
      await toggleHabitCheckinToday(item, item.goal.dimension_key, hasToday, currentSet.size)
    } catch (e) {
      setError((e as Error).message)
      setCheckinsBySubgoal((prev) => {
        const next = new Map(prev)
        next.set(item.id, currentSet)
        return next
      })
    } finally {
      setTogglingHabitId(null)
    }
  }

  async function handleToggle(item: WeeklySubgoal) {
    const nextCompleted = !item.completed
    setWeeklyList((prev) =>
      prev.map((s) =>
        s.id === item.id
          ? { ...s, completed: nextCompleted, completed_at: nextCompleted ? new Date().toISOString() : null }
          : s,
      ),
    )
    try {
      await setSubgoalCompleted(item, nextCompleted, item.goal.dimension_key)
    } catch (e) {
      setError((e as Error).message)
      setWeeklyList((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, completed: item.completed, completed_at: item.completed_at } : s)),
      )
    }
  }

  async function handleDeleteWeekly(item: WeeklySubgoal) {
    if (!window.confirm('¿Seguro que quieres borrar esta submeta?')) return

    setError(null)
    try {
      await deleteSubgoal(item.id)
      setWeeklyList((prev) => prev.filter((s) => s.id !== item.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function openPicker() {
    setShowPicker(true)
    if (!user) return
    setPickerLoading(true)
    setError(null)
    try {
      const [assignableList, goals] = await Promise.all([
        listAssignableSubgoals(user.id, weekStart),
        listGoalOptions(user.id),
      ])
      setAssignable(assignableList)
      setGoalOptions(goals)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPickerLoading(false)
    }
  }

  async function handleChooseExisting(subgoalId: string) {
    if (weeklyList.length >= MAX_WEEKLY_GOALS) return
    setError(null)
    try {
      await assignSubgoalToWeek(subgoalId, weekStart)
      await refreshWeeklyList()
      setAssignable((prev) => prev.filter((s) => s.id !== subgoalId))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleCreateNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || weeklyList.length >= MAX_WEEKLY_GOALS) return

    const form = e.currentTarget
    const formData = new FormData(form)
    const goalId = String(formData.get('goal_id') ?? '')
    const text = String(formData.get('text') ?? '').trim()
    const kind = (String(formData.get('goal_kind') ?? 'once') as GoalKind)
    const gemsReward = Number(formData.get('gems_reward') ?? (kind === 'habit' ? 2 : 10))
    const targetDaysPerWeek = kind === 'habit' ? Number(formData.get('target_days_per_week') ?? 5) : null

    if (!goalId || !text) return

    setError(null)
    try {
      await createSubgoalForWeek(user.id, goalId, text, gemsReward, weekStart, kind, targetDaysPerWeek)
      await refreshWeeklyList()
      form.reset()
      setNewGoalKind('once')
      setShowPicker(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading) {
    return (
      <section className="weekly-goals-section">
        <h2>Metas Semanales</h2>
        <p>Cargando...</p>
      </section>
    )
  }

  const completedCount = weeklyList.filter((s) => s.completed).length
  const slotsAvailable = weeklyList.length < MAX_WEEKLY_GOALS

  const assignableByGoal = new Map<string, { goal: AssignableSubgoal['goal']; items: AssignableSubgoal[] }>()
  for (const item of assignable) {
    const existing = assignableByGoal.get(item.goal_id)
    if (existing) {
      existing.items.push(item)
    } else {
      assignableByGoal.set(item.goal_id, { goal: item.goal, items: [item] })
    }
  }

  return (
    <section className="weekly-goals-section">
      <h2>
        Metas Semanales · {completedCount}/{MAX_WEEKLY_GOALS}
      </h2>

      {error && <p className="auth-error">{error}</p>}

      <div className="weekly-card-stack">
        {weeklyList.map((item) => {
          const color = item.goal.dimension?.color_hex ?? '#6ee7b7'

          if (item.goal_kind === 'habit') {
            const checkins = checkinsBySubgoal.get(item.id) ?? new Set<string>()
            const target = item.target_days_per_week ?? 7
            const metThisWeek = checkins.size >= target
            return (
              <div
                key={item.id}
                className={`weekly-card habit${metThisWeek ? ' completed' : ''}`}
                style={{ ['--dim-color' as string]: color }}
              >
                <div className="weekly-habit-header">
                  <span className="weekly-card-text">{item.text}</span>
                  <span className="weekly-habit-count">
                    {checkins.size}/{target}
                  </span>
                  <button
                    type="button"
                    className="weekly-delete-btn"
                    onClick={() => handleDeleteWeekly(item)}
                    title="Borrar submeta"
                    aria-label="Borrar submeta"
                  >
                    <Trash2 size={15} strokeWidth={1.75} />
                  </button>
                </div>
                <HabitDotsRow
                  checkinDates={checkins}
                  dimensionColor={color}
                  onToggleToday={() => handleToggleHabitToday(item)}
                  toggling={togglingHabitId === item.id}
                />
              </div>
            )
          }

          return (
            <div
              key={item.id}
              className={`weekly-card${item.completed ? ' completed' : ''}`}
              style={{ ['--dim-color' as string]: color }}
            >
              <button
                type="button"
                className="weekly-check-circle"
                onClick={() => handleToggle(item)}
                aria-label={item.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
              >
                {item.completed && <Check size={16} strokeWidth={2.5} />}
              </button>
              <span className="weekly-card-text">{item.text}</span>
              {!item.completed && (
                <button
                  type="button"
                  className="weekly-delete-btn"
                  onClick={() => handleDeleteWeekly(item)}
                  title="Borrar submeta"
                  aria-label="Borrar submeta"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              )}
            </div>
          )
        })}

        {weeklyList.length === 0 && <p className="subgoal-empty">Sin metas elegidas esta semana</p>}
      </div>

      {slotsAvailable && (
        <button type="button" className="area-new-goal-btn" onClick={openPicker}>
          + Elegir meta semanal
        </button>
      )}

      {showPicker && (
        <div className="weekly-picker">
          {pickerLoading && <p>Cargando opciones...</p>}

          {!pickerLoading && (
            <>
              <h3>Elegir una submeta existente</h3>
              {assignableByGoal.size === 0 && <p className="subgoal-empty">No hay submetas pendientes sin asignar</p>}
              {[...assignableByGoal.entries()].map(([goalId, group]) => (
                <div key={goalId} className="weekly-picker-group">
                  <p className="weekly-picker-goal-label">
                    {group.goal.dimension?.label ?? group.goal.dimension_key} · {group.goal.text}
                  </p>
                  <ul className="weekly-picker-list">
                    {group.items.map((s) => (
                      <li key={s.id}>
                        <span>{s.text}</span>
                        <button
                          type="button"
                          disabled={!slotsAvailable}
                          onClick={() => handleChooseExisting(s.id)}
                        >
                          Elegir
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <h3>O crear una nueva</h3>
              <form className="area-form" onSubmit={handleCreateNew}>
                <label>
                  Meta grande
                  <select name="goal_id" required defaultValue="">
                    <option value="" disabled>
                      Selecciona una meta
                    </option>
                    {goalOptions.map((g) => (
                      <option key={g.id} value={g.id}>
                        {(g.dimension?.label ?? g.dimension_key) + ' · ' + g.text}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Texto
                  <input name="text" type="text" required />
                </label>
                <label>
                  Tipo de meta
                  <select
                    name="goal_kind"
                    value={newGoalKind}
                    onChange={(e) => setNewGoalKind(e.target.value as GoalKind)}
                  >
                    <option value="once">✓ Una sola acción</option>
                    <option value="habit">🔁 Hábito recurrente</option>
                  </select>
                </label>
                {newGoalKind === 'habit' && (
                  <label>
                    ¿Cuántos días a la semana?
                    <input name="target_days_per_week" type="number" defaultValue={5} min={1} max={7} required />
                  </label>
                )}
                <label>
                  Gemas de recompensa {newGoalKind === 'habit' ? '(por cada día marcado)' : ''}
                  <input key={newGoalKind} name="gems_reward" type="number" defaultValue={newGoalKind === 'habit' ? 2 : 10} min={0} />
                </label>
                <button type="submit" disabled={!slotsAvailable}>
                  Agregar y asignar esta semana
                </button>
              </form>
            </>
          )}

          <button type="button" className="weekly-picker-close" onClick={() => setShowPicker(false)}>
            Cerrar
          </button>
        </div>
      )}
    </section>
  )
}
