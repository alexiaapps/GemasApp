import { ArrowLeft, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import HabitDotsRow from '../components/HabitDotsRow'
import {
  completeSubgoal,
  createSubgoal,
  deleteSubgoal,
  getDimension,
  getGoal,
  listSubgoalsByGoal,
  type Dimension,
  type Goal,
  type GoalKind,
  type Subgoal,
} from '../lib/areas'
import { getContrastTextColor } from '../lib/color'
import { currentWeekStartISO, todayISO, weekEndISO } from '../lib/date'
import { groupCheckinsBySubgoal, listCheckinsForSubgoals, toggleHabitCheckinToday } from '../lib/habits'

export default function GoalDetail() {
  const { key, goalId } = useParams<{ key: string; goalId: string }>()
  const { user } = useAuth()

  const [dimension, setDimension] = useState<Dimension | null>(null)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [subgoals, setSubgoals] = useState<Subgoal[]>([])
  const [checkinsBySubgoal, setCheckinsBySubgoal] = useState<Map<string, Set<string>>>(new Map())
  const [togglingHabitId, setTogglingHabitId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!goalId || !key) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [dim, goalRow, subgoalList] = await Promise.all([
          getDimension(key!),
          getGoal(goalId!),
          listSubgoalsByGoal(goalId!),
        ])
        if (cancelled) return
        setDimension(dim)
        setGoal(goalRow)
        setSubgoals(subgoalList)

        const habitIds = subgoalList.filter((s) => s.goal_kind === 'habit').map((s) => s.id)
        if (habitIds.length > 0) {
          const weekStart = currentWeekStartISO()
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
  }, [key, goalId])

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
  const textColor = getContrastTextColor(dimColor)

  return (
    <div className="page goal-detail-page">
      <div className="goal-detail-header" style={{ background: dimColor, color: textColor }}>
        <Link to={`/areas/${key}`} className="goal-detail-back" style={{ color: textColor }}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </Link>
        <span className="goal-detail-emoji">{goal.icon_emoji || dimension?.emoji}</span>
        <h1 className="goal-detail-title">{goal.text}</h1>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <SubgoalsForm dimColor={dimColor} onCreateSubgoal={handleCreateSubgoal} />

      <ul className="subgoal-list">
        {subgoals
          .filter((s) => s.goal_kind === 'once' && !s.completed)
          .map((s) => (
            <li key={s.id}>
              <input type="checkbox" checked={false} onChange={() => handleCompleteSubgoal(s)} />
              <span className="subgoal-item-text">
                {s.text} · {s.gems_reward} gemas
              </span>
              <button
                className="subgoal-delete-btn"
                onClick={() => handleDeleteSubgoal(s)}
                title="Borrar submeta"
                aria-label="Borrar submeta"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        {subgoals
          .filter((s) => s.goal_kind === 'once' && s.completed)
          .map((s) => (
            <li key={s.id} className="subgoal-completed">
              <input type="checkbox" checked disabled />
              <span style={{ textDecoration: 'line-through' }}>{s.text}</span> · {s.gems_reward} gemas
            </li>
          ))}
        {subgoals.length === 0 && <li className="subgoal-empty">Sin submetas todavía</li>}
      </ul>

      {subgoals.some((s) => s.goal_kind === 'habit') && (
        <ul className="subgoal-list habit-subgoal-list">
          {subgoals
            .filter((s) => s.goal_kind === 'habit')
            .map((s) => {
              const checkins = checkinsBySubgoal.get(s.id) ?? new Set<string>()
              const target = s.target_days_per_week ?? 7
              const metThisWeek = checkins.size >= target
              return (
                <li key={s.id} className={`habit-subgoal-item${metThisWeek ? ' met' : ''}`}>
                  <div className="habit-subgoal-header">
                    <span className="subgoal-item-text">{s.text}</span>
                    <span className="habit-subgoal-count">
                      {checkins.size}/{target} días esta semana
                    </span>
                    <button
                      className="subgoal-delete-btn"
                      onClick={() => handleDeleteSubgoal(s)}
                      title="Borrar submeta"
                      aria-label="Borrar submeta"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                  <HabitDotsRow
                    checkinDates={checkins}
                    dimensionColor={dimColor}
                    onToggleToday={() => handleToggleHabitToday(s)}
                    toggling={togglingHabitId === s.id}
                  />
                </li>
              )
            })}
        </ul>
      )}
    </div>
  )
}

function SubgoalsForm({
  dimColor,
  onCreateSubgoal,
}: {
  dimColor: string
  onCreateSubgoal: (kind: GoalKind, e: FormEvent<HTMLFormElement>) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [kind, setKind] = useState<GoalKind>('once')

  return (
    <>
      <button
        className="area-new-goal-btn goal-detail-add-btn"
        style={{ borderColor: dimColor, color: dimColor }}
        onClick={() => setShowForm((v) => !v)}
      >
        + Agregar submeta
      </button>

      {showForm && (
        <form
          className="area-form"
          onSubmit={(e) => {
            onCreateSubgoal(kind, e)
            setShowForm(false)
            setKind('once')
          }}
        >
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
            <input
              key={kind}
              name="gems_reward"
              type="number"
              defaultValue={kind === 'habit' ? 2 : 10}
              min={0}
            />
          </label>
          <button type="submit">Guardar submeta</button>
        </form>
      )}
    </>
  )
}
