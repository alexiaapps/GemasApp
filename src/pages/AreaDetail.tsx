import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Circle, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AffirmationGallery from '../components/AffirmationGallery'
import GoalAffirmationsSection from '../components/GoalAffirmationsSection'
import HabitDotsRow from '../components/HabitDotsRow'
import {
  completeGoal,
  completeSubgoal,
  createGoal,
  createSubgoal,
  deleteGoal,
  deleteSubgoal,
  getDimension,
  listGoalsByDimension,
  listSubgoalsByGoal,
  type Dimension,
  type Goal,
  type GoalKind,
  type Subgoal,
} from '../lib/areas'
import { currentWeekStartISO, todayISO, weekEndISO } from '../lib/date'
import { groupCheckinsBySubgoal, listCheckinsForSubgoals, toggleHabitCheckinToday } from '../lib/habits'

export default function AreaDetail() {
  const { key } = useParams<{ key: string }>()
  const { user } = useAuth()

  const [dimension, setDimension] = useState<Dimension | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showNewGoalForm, setShowNewGoalForm] = useState(false)

  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({})
  const [subgoalsByGoal, setSubgoalsByGoal] = useState<Record<string, Subgoal[]>>({})
  const [checkinsBySubgoal, setCheckinsBySubgoal] = useState<Map<string, Set<string>>>(new Map())
  const [togglingHabitId, setTogglingHabitId] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !key) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [dim, goalList] = await Promise.all([
          getDimension(key!),
          listGoalsByDimension(user!.id, key!),
        ])
        if (cancelled) return
        setDimension(dim)
        setGoals(goalList)
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
  }, [user, key])

  async function handleCreateGoal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || !key) return

    const form = e.currentTarget
    const formData = new FormData(form)
    const text = String(formData.get('text') ?? '').trim()
    const category = String(formData.get('category') ?? '').trim() || 'Otro'
    const gemsReward = Number(formData.get('gems_reward') ?? 50)

    if (!text) return

    try {
      const goal = await createGoal(user.id, key, text, category, gemsReward)
      setGoals((prev) => [goal, ...prev])
      form.reset()
      setShowNewGoalForm(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleCompleteGoal(goal: Goal) {
    try {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goal.id ? { ...g, completed: true, completed_at: new Date().toISOString() } : g,
        ),
      )
      await completeGoal(goal)
    } catch (err) {
      setError((err as Error).message)
      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? { ...g, completed: false, completed_at: null } : g)),
      )
    }
  }

  async function toggleExpand(goalId: string) {
    const isExpanded = !!expandedGoals[goalId]
    setExpandedGoals((prev) => ({ ...prev, [goalId]: !isExpanded }))

    if (!isExpanded && !subgoalsByGoal[goalId]) {
      try {
        const subgoals = await listSubgoalsByGoal(goalId)
        setSubgoalsByGoal((prev) => ({ ...prev, [goalId]: subgoals }))

        const habitIds = subgoals.filter((s) => s.goal_kind === 'habit').map((s) => s.id)
        if (habitIds.length > 0) {
          const weekStart = currentWeekStartISO()
          const checkins = await listCheckinsForSubgoals(habitIds, weekStart, weekEndISO(weekStart))
          const grouped = groupCheckinsBySubgoal(checkins)
          setCheckinsBySubgoal((prev) => new Map([...prev, ...grouped]))
        }
      } catch (err) {
        setError((err as Error).message)
      }
    }
  }

  async function handleCreateSubgoal(goalId: string, kind: GoalKind, e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return

    const form = e.currentTarget
    const formData = new FormData(form)
    const text = String(formData.get('text') ?? '').trim()
    const gemsReward = Number(formData.get('gems_reward') ?? (kind === 'habit' ? 2 : 10))
    const targetDaysPerWeek = kind === 'habit' ? Number(formData.get('target_days_per_week') ?? 5) : null

    if (!text) return

    try {
      const subgoal = await createSubgoal(user.id, goalId, text, gemsReward, kind, targetDaysPerWeek)
      setSubgoalsByGoal((prev) => ({
        ...prev,
        [goalId]: [...(prev[goalId] ?? []), subgoal],
      }))
      form.reset()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleToggleHabitToday(subgoal: Subgoal, dimensionKey: string) {
    if (!user) return
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
      await toggleHabitCheckinToday(subgoal, dimensionKey, hasToday, currentSet.size)
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

  async function handleCompleteSubgoal(goalId: string, subgoal: Subgoal, dimensionKey: string) {
    try {
      setSubgoalsByGoal((prev) => ({
        ...prev,
        [goalId]: (prev[goalId] ?? []).map((s) =>
          s.id === subgoal.id ? { ...s, completed: true, completed_at: new Date().toISOString() } : s,
        ),
      }))
      await completeSubgoal(subgoal, dimensionKey)
    } catch (err) {
      setError((err as Error).message)
      setSubgoalsByGoal((prev) => ({
        ...prev,
        [goalId]: (prev[goalId] ?? []).map((s) =>
          s.id === subgoal.id ? { ...s, completed: false, completed_at: null } : s,
        ),
      }))
    }
  }

  async function handleDeleteGoal(goal: Goal) {
    const base = '¿Seguro que quieres borrar esta meta y todas sus submetas?'
    const message = goal.completed
      ? `Esta meta ya fue completada y ya otorgó ${goal.gems_reward} gemas — esas gemas NO se te van a quitar al borrarla.\n\n${base}`
      : base

    if (!window.confirm(message)) return

    try {
      await deleteGoal(goal.id)
      setGoals((prev) => prev.filter((g) => g.id !== goal.id))
      setSubgoalsByGoal((prev) => {
        const next = { ...prev }
        delete next[goal.id]
        return next
      })
      setExpandedGoals((prev) => {
        const next = { ...prev }
        delete next[goal.id]
        return next
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleDeleteSubgoal(goalId: string, subgoal: Subgoal) {
    if (!window.confirm('¿Seguro que quieres borrar esta submeta?')) return

    try {
      await deleteSubgoal(subgoal.id)
      setSubgoalsByGoal((prev) => ({
        ...prev,
        [goalId]: (prev[goalId] ?? []).filter((s) => s.id !== subgoal.id),
      }))
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

  return (
    <div className="page">
      <Link to="/areas" className="area-back">
        <ArrowLeft size={16} strokeWidth={1.75} /> Áreas
      </Link>

      <h1>
        {dimension?.emoji} {dimension?.label ?? key}
      </h1>

      {error && <p className="auth-error">{error}</p>}

      <button className="area-new-goal-btn" onClick={() => setShowNewGoalForm((v) => !v)}>
        + Nueva meta grande
      </button>

      {showNewGoalForm && (
        <form className="area-form" onSubmit={handleCreateGoal}>
          <label>
            Texto
            <input name="text" type="text" required />
          </label>
          <label>
            Categoría
            <input name="category" type="text" placeholder="Otro" />
          </label>
          <label>
            Gemas de recompensa
            <input name="gems_reward" type="number" defaultValue={50} min={0} />
          </label>
          <button type="submit">Guardar meta</button>
        </form>
      )}

      <ul className="goal-list">
        {goals.map((goal) => (
          <li key={goal.id} className={`goal-item${goal.completed ? ' completed' : ''}`}>
            <div className="goal-row">
              <input
                type="checkbox"
                checked={goal.completed}
                disabled={goal.completed}
                onChange={() => handleCompleteGoal(goal)}
              />
              <span className="goal-text" onClick={() => toggleExpand(goal.id)}>
                {goal.completed ? (
                  <CheckCircle2 size={15} strokeWidth={1.75} />
                ) : (
                  <Circle size={15} strokeWidth={1.75} />
                )}{' '}
                {goal.text}
                {goal.category ? ` · ${goal.category}` : ''} · {goal.gems_reward} gemas
              </span>
              <button className="goal-expand-btn" onClick={() => toggleExpand(goal.id)}>
                {expandedGoals[goal.id] ? (
                  <ChevronUp size={16} strokeWidth={1.75} />
                ) : (
                  <ChevronDown size={16} strokeWidth={1.75} />
                )}
              </button>
              <button
                className="goal-delete-btn"
                onClick={() => handleDeleteGoal(goal)}
                title="Borrar meta"
                aria-label="Borrar meta"
              >
                <Trash2 size={15} strokeWidth={1.75} />
              </button>
            </div>

            {expandedGoals[goal.id] && (
              <SubgoalsSection
                goal={goal}
                subgoals={subgoalsByGoal[goal.id] ?? []}
                dimensionColor={dimension?.color_hex ?? '#6ee7b7'}
                checkinsBySubgoal={checkinsBySubgoal}
                togglingHabitId={togglingHabitId}
                onCreateSubgoal={(kind, e) => handleCreateSubgoal(goal.id, kind, e)}
                onCompleteSubgoal={(subgoal) =>
                  handleCompleteSubgoal(goal.id, subgoal, goal.dimension_key)
                }
                onDeleteSubgoal={(subgoal) => handleDeleteSubgoal(goal.id, subgoal)}
                onToggleHabitToday={(subgoal) => handleToggleHabitToday(subgoal, goal.dimension_key)}
              />
            )}

            {expandedGoals[goal.id] && user && (
              <GoalAffirmationsSection userId={user.id} goalId={goal.id} />
            )}
          </li>
        ))}
      </ul>

      {user && key && <AffirmationGallery userId={user.id} dimensionKey={key} />}
    </div>
  )
}

function SubgoalsSection({
  subgoals,
  dimensionColor,
  checkinsBySubgoal,
  togglingHabitId,
  onCreateSubgoal,
  onCompleteSubgoal,
  onDeleteSubgoal,
  onToggleHabitToday,
}: {
  goal: Goal
  subgoals: Subgoal[]
  dimensionColor: string
  checkinsBySubgoal: Map<string, Set<string>>
  togglingHabitId: string | null
  onCreateSubgoal: (kind: GoalKind, e: FormEvent<HTMLFormElement>) => void
  onCompleteSubgoal: (subgoal: Subgoal) => void
  onDeleteSubgoal: (subgoal: Subgoal) => void
  onToggleHabitToday: (subgoal: Subgoal) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [kind, setKind] = useState<GoalKind>('once')
  const pending = subgoals.filter((s) => s.goal_kind === 'once' && !s.completed)
  const completed = subgoals.filter((s) => s.goal_kind === 'once' && s.completed)
  const habits = subgoals.filter((s) => s.goal_kind === 'habit')

  return (
    <div className="subgoals-section">
      <button className="area-new-goal-btn" onClick={() => setShowForm((v) => !v)}>
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

      <ul className="subgoal-list">
        {pending.map((s) => (
          <li key={s.id}>
            <input type="checkbox" checked={false} onChange={() => onCompleteSubgoal(s)} />
            <span className="subgoal-item-text">
              {s.text} · {s.gems_reward} gemas
            </span>
            <button
              className="subgoal-delete-btn"
              onClick={() => onDeleteSubgoal(s)}
              title="Borrar submeta"
              aria-label="Borrar submeta"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </li>
        ))}
        {completed.map((s) => (
          <li key={s.id} className="subgoal-completed">
            <input type="checkbox" checked disabled />
            <span style={{ textDecoration: 'line-through' }}>{s.text}</span> · {s.gems_reward} gemas
          </li>
        ))}
        {subgoals.length === 0 && <li className="subgoal-empty">Sin submetas todavía</li>}
      </ul>

      {habits.length > 0 && (
        <ul className="subgoal-list habit-subgoal-list">
          {habits.map((s) => {
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
                    onClick={() => onDeleteSubgoal(s)}
                    title="Borrar submeta"
                    aria-label="Borrar submeta"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
                <HabitDotsRow
                  checkinDates={checkins}
                  dimensionColor={dimensionColor}
                  onToggleToday={() => onToggleHabitToday(s)}
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
