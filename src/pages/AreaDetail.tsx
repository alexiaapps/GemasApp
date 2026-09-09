import { ArrowLeft, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AffirmationPlaylist from '../components/AffirmationPlaylist'
import AreaResourcesSection from '../components/AreaResourcesSection'
import {
  completeGoal,
  createGoal,
  deleteGoal,
  getDimension,
  listGoalsByDimension,
  type Dimension,
  type Goal,
} from '../lib/areas'
import { getContrastTextColor } from '../lib/color'

const COMMON_GOAL_EMOJIS = [
  '🎯', '🚀', '💪', '📚', '💰', '❤️', '🧘', '🏃', '🎨', '🎵', '🌱', '🏆', '✈️', '🍎', '💡', '🔥', '⭐', '🎓',
]

export default function AreaDetail() {
  const { key } = useParams<{ key: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [dimension, setDimension] = useState<Dimension | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showNewGoalForm, setShowNewGoalForm] = useState(false)
  const [newGoalEmoji, setNewGoalEmoji] = useState('')

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
      const goal = await createGoal(user.id, key, text, category, gemsReward, newGoalEmoji || null)
      setGoals((prev) => [goal, ...prev])
      form.reset()
      setNewGoalEmoji('')
      setShowNewGoalForm(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleCompleteGoal(e: MouseEvent, goal: Goal) {
    e.preventDefault()
    e.stopPropagation()
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

  async function handleDeleteGoal(e: MouseEvent, goal: Goal) {
    e.preventDefault()
    e.stopPropagation()
    const base = '¿Seguro que quieres borrar esta meta y todas sus submetas?'
    const message = goal.completed
      ? `Esta meta ya fue completada y ya otorgó ${goal.gems_reward} gemas — esas gemas NO se te van a quitar al borrarla.\n\n${base}`
      : base

    if (!window.confirm(message)) return

    try {
      await deleteGoal(goal.id)
      setGoals((prev) => prev.filter((g) => g.id !== goal.id))
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

  const dimColor = dimension?.color_hex ?? '#6ee7b7'
  const textColor = getContrastTextColor(dimColor)

  return (
    <div className="page area-detail-page">
      <div className="area-detail-header" style={{ background: dimColor, color: textColor }}>
        <Link to="/areas" className="area-detail-back" style={{ color: textColor }}>
          <ArrowLeft size={18} strokeWidth={1.75} />
          Áreas
        </Link>
        <h1 className="area-detail-title">
          {dimension?.emoji} {dimension?.label ?? key}
        </h1>
      </div>

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
            Ícono
            <input
              type="text"
              value={newGoalEmoji}
              onChange={(e) => setNewGoalEmoji(e.target.value)}
              placeholder={dimension?.emoji ? `Por defecto: ${dimension.emoji}` : 'Elige un emoji'}
              maxLength={4}
              className="emoji-text-input"
            />
          </label>
          <div className="emoji-picker-grid">
            {COMMON_GOAL_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`emoji-picker-option${newGoalEmoji === emoji ? ' selected' : ''}`}
                onClick={() => setNewGoalEmoji(emoji)}
                aria-label={`Usar ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
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
        {goals.map((goal) => {
          const cardText = textColor
          return (
            <li key={goal.id} className={`goal-item goal-item-colored${goal.completed ? ' completed' : ''}`}>
              <div
                className="goal-row"
                style={{ background: dimColor, color: cardText, cursor: 'pointer' }}
                onClick={() => navigate(`/areas/${key}/${goal.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/areas/${key}/${goal.id}`)
                }}
              >
                <input
                  type="checkbox"
                  checked={goal.completed}
                  disabled={goal.completed}
                  onClick={(e) => handleCompleteGoal(e, goal)}
                  onChange={() => {}}
                  style={{ accentColor: cardText }}
                />
                <span className="goal-emoji">{goal.icon_emoji || dimension?.emoji}</span>
                <span className="goal-title">{goal.text}</span>
                <button
                  className="goal-delete-btn"
                  onClick={(e) => handleDeleteGoal(e, goal)}
                  title="Borrar meta"
                  aria-label="Borrar meta"
                  style={{ color: cardText }}
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </div>
            </li>
          )
        })}
        {goals.length === 0 && <li className="subgoal-empty">Sin metas todavía</li>}
      </ul>

      {user && key && (
        <AffirmationPlaylist
          userId={user.id}
          dimensionKey={key}
          title="Mi Visión"
          emptyMessage="Todavía no tienes afirmaciones en esta área"
        />
      )}

      {user && key && <AreaResourcesSection userId={user.id} dimensionKey={key} />}
    </div>
  )
}
