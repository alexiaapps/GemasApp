import { ArrowLeft, Check, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import HabitDotsRow from '../components/HabitDotsRow'
import {
  completeGoal,
  completeSubgoal,
  createSubgoal,
  deleteGoal,
  deleteSubgoal,
  getDimension,
  getGoal,
  listSubgoalsByGoal,
  type Dimension,
  type Goal,
  type GoalKind,
  type Subgoal,
} from '../lib/areas'
import { pastelOf } from '../lib/color'
import { currentWeekStartISO, todayISO, weekEndISO } from '../lib/date'
import { groupCheckinsBySubgoal, listCheckinsForSubgoals, toggleHabitCheckinToday } from '../lib/habits'
import { MAX_WEEKLY_GOALS, assignSubgoalToWeek, listWeeklySubgoals } from '../lib/weeklyGoals'

export default function GoalDetail() {
  const { key, goalId } = useParams<{ key: string; goalId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const weekStart = currentWeekStartISO()

  const [dimension, setDimension] = useState<Dimension | null>(null)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [subgoals, setSubgoals] = useState<Subgoal[]>([])
  const [checkinsBySubgoal, setCheckinsBySubgoal] = useState<Map<string, Set<string>>>(new Map())
  const [togglingHabitId, setTogglingHabitId] = useState<string | null>(null)
  const [weekIds, setWeekIds] = useState<Set<string>>(new Set())
  const [addingToWeekId, setAddingToWeekId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userId = user?.id

  useEffect(() => {
    if (!goalId || !key || !userId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [dim, goalRow, subgoalList, weeklyList] = await Promise.all([
          getDimension(key!),
          getGoal(goalId!),
          listSubgoalsByGoal(goalId!),
          listWeeklySubgoals(userId!, weekStart),
        ])
        if (cancelled) return
        setDimension(dim)
        setGoal(goalRow)
        setSubgoals(subgoalList)
        setWeekIds(new Set(weeklyList.map((s) => s.id)))

        const habitIds = subgoalList.filter((s) => s.goal_kind === 'habit').map((s) => s.id)
        if (habitIds.length > 0) {
          const checkins = await listCheckinsForSubgoals(habitIds, weekStart, weekEndISO(weekStart))
          if (!cancelled) setCheckinsBySubgoal(groupCheckinsBySubgoal(checkins))
        }
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
  }, [key, goalId, userId, weekStart])

  async function handleCreateSubgoal(kind: GoalKind, e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || !goalId) return

    const form = e.currentTarget
    const formData = new FormData(form)
    const text = String(formData.get('text') ?? '').trim()
    const gemsReward = Number(formData.get('gems_reward') ?? (kind === 'habit' ? 2 : 10))
    const targetDaysPerWeek = kind === 'habit' ? Number(formData.get('target_days_per_week') ?? 5) : null

    if (!text) return

    try {
      const subgoal = await createSubgoal(user.id, goalId, text, gemsReward, kind, targetDaysPerWeek)
      setSubgoals((prev) => [...prev, subgoal])
      form.reset()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleCompleteSubgoal(subgoal: Subgoal) {
    if (!goal) return
    try {
      setSubgoals((prev) =>
        prev.map((s) =>
          s.id === subgoal.id ? { ...s, completed: true, completed_at: new Date().toISOString() } : s,
        ),
      )
      await completeSubgoal(subgoal, goal.dimension_key)
    } catch (err) {
      setError((err as Error).message)
      setSubgoals((prev) =>
        prev.map((s) => (s.id === subgoal.id ? { ...s, completed: false, completed_at: null } : s)),
      )
    }
  }

  async function handleDeleteSubgoal(subgoal: Subgoal) {
    if (!window.confirm('¿Seguro que quieres borrar esta submeta?')) return
    try {
      await deleteSubgoal(subgoal.id)
      setSubgoals((prev) => prev.filter((s) => s.id !== subgoal.id))
      setWeekIds((prev) => {
        const next = new Set(prev)
        next.delete(subgoal.id)
        return next
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleToggleHabitToday(subgoal: Subgoal) {
    if (!user || !goal) return
    const today = todayISO()
    const currentSet = checkinsBySubgoal.get(subgoal.id) ?? new Set<string>()
    const hasToday = currentSet.has(today)

    setTogglingHabitId(subgoal.id)
    setCheckinsBySubgoal((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(subgoal.id) ?? [])
      if (hasToday) set.delete(today)
      else set.add(today)
      next.set(subgoal.id, set)
      return next
    })

    try {
      await toggleHabitCheckinToday(subgoal, goal.dimension_key, hasToday, currentSet.size)
    } catch (err) {
      setError((err as Error).message)
      setCheckinsBySubgoal((prev) => {
        const next = new Map(prev)
        next.set(subgoal.id, currentSet)
        return next
      })
    } finally {
      setTogglingHabitId(null)
    }
  }

  async function handleAddToWeek(subgoal: Subgoal) {
    if (weekIds.has(subgoal.id) || weekIds.size >= MAX_WEEKLY_GOALS) return
    setAddingToWeekId(subgoal.id)
    setError(null)
    try {
      await assignSubgoalToWeek(subgoal.id, weekStart)
      setWeekIds((prev) => new Set(prev).add(subgoal.id))
      setSubgoals((prev) => prev.map((s) => (s.id === subgoal.id ? { ...s, week_start_date: weekStart } : s)))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAddingToWeekId(null)
    }
  }

  async function handleCompleteGoal() {
    if (!goal || goal.completed) return
    try {
      setGoal({ ...goal, completed: true, completed_at: new Date().toISOString() })
      await completeGoal(goal)
    } catch (err) {
      setError((err as Error).message)
      setGoal(goal)
    }
  }

  async function handleDeleteGoal() {
    if (!goal) return
    const base = '¿Seguro que quieres borrar esta meta y todas sus submetas?'
    const message = goal.completed
      ? `Esta meta ya fue completada y ya otorgó ${goal.gems_reward} gemas — esas gemas NO se te van a quitar al borrarla.\n\n${base}`
      : base
    if (!window.confirm(message)) return

    try {
      await deleteGoal(goal.id)
      navigate(`/areas/${key}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Cargando...</p>
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="page">
        <p>Meta no encontrada.</p>
      </div>
    )
  }

  const dimColor = dimension?.color_hex ?? '#6ee7b7'
  const limitReached = weekIds.size >= MAX_WEEKLY_GOALS

  function isDone(s: Subgoal): boolean {
    if (s.goal_kind === 'habit') {
      const count = checkinsBySubgoal.get(s.id)?.size ?? 0
      return s.target_days_per_week != null && count >= s.target_days_per_week
    }
    return s.completed
  }

  const doneCount = subgoals.filter(isDone).length

  return (
    <div className="page goal-detail-page">
      <div className="goal-detail-header" style={{ background: pastelOf(dimColor) }}>
        <Link to={`/areas/${key}`} className="goal-detail-back">
          <ArrowLeft size={18} strokeWidth={1.75} />
          {dimension?.label ?? 'Área'}
        </Link>
        <div className="goal-detail-heading">
          <span className="goal-detail-emoji">{goal.icon_emoji || dimension?.emoji}</span>
          <h1 className="goal-detail-title">{goal.text}</h1>
        </div>
        <div className="goal-detail-pills">
          <span className="pill-oval">
            {doneCount}/{subgoals.length} metas
          </span>
          <span className="pill-oval">+{goal.gems_reward} gemas</span>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="section-head">
        <h2>Submetas</h2>
        <button
          type="button"
          className="round-add-btn"
          onClick={() => setShowForm((v) => !v)}
          aria-label={showForm ? 'Cerrar formulario' : 'Agregar submeta'}
          title={showForm ? 'Cerrar' : 'Agregar submeta'}
        >
          {showForm ? <X size={18} strokeWidth={2.25} /> : <Plus size={18} strokeWidth={2.25} />}
        </button>
      </div>

      {showForm && (
        <SubgoalForm
          onSubmit={(kind, e) => {
            handleCreateSubgoal(kind, e)
            setShowForm(false)
          }}
        />
      )}

      <ul className="subgoal-cards">
        {subgoals.map((s) => {
          const done = isDone(s)
          const isHabit = s.goal_kind === 'habit'
          const checkins = checkinsBySubgoal.get(s.id) ?? new Set<string>()
          const inWeek = weekIds.has(s.id)
          const canAddToWeek = isHabit || !s.completed

          return (
            <li
              key={s.id}
              className={`subgoal-card${done ? ' done' : ''}`}
              style={{
                ['--area-color' as string]: dimColor,
                background: done ? pastelOf(dimColor) : undefined,
              }}
            >
              <button
                type="button"
                className="subgoal-check"
                disabled={done || isHabit}
                onClick={() => handleCompleteSubgoal(s)}
                aria-label={done ? 'Completada' : 'Marcar como completada'}
              >
                {done && <Check size={16} strokeWidth={3} />}
              </button>

              <div className="subgoal-body">
                <span className="subgoal-title">{s.text}</span>
                <span className="subgoal-meta">
                  {isHabit
                    ? `${checkins.size}/${s.target_days_per_week ?? 7} días · ${s.gems_reward} gemas`
                    : `${s.gems_reward} gemas`}
                  <button
                    type="button"
                    className="subgoal-delete-btn"
                    onClick={() => handleDeleteSubgoal(s)}
                    title="Borrar submeta"
                    aria-label="Borrar submeta"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </span>
                {isHabit && (
                  <HabitDotsRow
                    checkinDates={checkins}
                    dimensionColor={dimColor}
                    onToggleToday={() => handleToggleHabitToday(s)}
                    toggling={togglingHabitId === s.id}
                  />
                )}
              </div>

              {inWeek ? (
                <span
                  className="week-add-btn added"
                  style={{ background: dimColor }}
                  title="Ya está en tus metas semanales"
                  aria-label="Ya está en tus metas semanales"
                >
                  <Check size={18} strokeWidth={3} />
                </span>
              ) : (
                canAddToWeek && (
                  <button
                    type="button"
                    className="week-add-btn"
                    onClick={() => handleAddToWeek(s)}
                    disabled={limitReached || addingToWeekId === s.id}
                    title={
                      limitReached
                        ? `Ya tienes ${MAX_WEEKLY_GOALS} metas esta semana`
                        : 'Agregar a mis metas semanales'
                    }
                    aria-label="Agregar a mis metas semanales"
                  >
                    <Plus size={18} strokeWidth={2.5} />
                  </button>
                )
              )}
            </li>
          )
        })}
        {subgoals.length === 0 && <li className="subgoal-empty">Sin submetas todavía</li>}
      </ul>

      <div className="goal-actions">
        {goal.completed ? (
          <span className="goal-action-done">
            <Check size={16} strokeWidth={3} /> Meta lograda
          </span>
        ) : (
          <button type="button" className="goal-action-btn" onClick={handleCompleteGoal}>
            <Check size={16} strokeWidth={2.5} /> Marcar meta como lograda
          </button>
        )}
        <button type="button" className="goal-action-btn danger" onClick={handleDeleteGoal}>
          <Trash2 size={16} strokeWidth={2} /> Borrar meta
        </button>
      </div>
    </div>
  )
}

function SubgoalForm({ onSubmit }: { onSubmit: (kind: GoalKind, e: FormEvent<HTMLFormElement>) => void }) {
  const [kind, setKind] = useState<GoalKind>('once')

  return (
    <form className="area-form" onSubmit={(e) => onSubmit(kind, e)}>
      <label>
        Texto
        <input name="text" type="text" required />
      </label>
      <label>
        Tipo de meta
        <select value={kind} onChange={(e) => setKind(e.target.value as GoalKind)}>
          <option value="once">✓ Una sola acción</option>
          <option value="habit">🔁 Hábito recurrente</option>
        </select>
      </label>
      {kind === 'habit' && (
        <label>
          ¿Cuántos días a la semana?
          <input name="target_days_per_week" type="number" defaultValue={5} min={1} max={7} required />
        </label>
      )}
      <label>
        Gemas de recompensa {kind === 'habit' ? '(por cada día marcado)' : ''}
        <input key={kind} name="gems_reward" type="number" defaultValue={kind === 'habit' ? 2 : 10} min={0} />
      </label>
      <button type="submit">Guardar submeta</button>
    </form>
  )
}
