import { ArrowLeft, ChevronRight, Plus, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AffirmationPlaylist from '../components/AffirmationPlaylist'
import AreaResourcesSection from '../components/AreaResourcesSection'
import { createGoal, getDimension, listGoalsByDimension, type Dimension, type Goal } from '../lib/areas'
import { getContrastTextColor, pastelOf } from '../lib/color'
import { MAX_GOAL_TEXT_LENGTH } from '../lib/scripts'

const COMMON_GOAL_EMOJIS = [
  '🎯', '🚀', '💪', '📚', '💰', '❤️', '🧘', '🏃', '🎨', '🎵', '🌱', '🏆', '✈️', '🍎', '💡', '🔥', '⭐', '🎓',
]

export default function AreaDetail() {
  const { key } = useParams<{ key: string }>()
  const { user } = useAuth()

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
        <div className="area-detail-heading">
          <span className="area-detail-emoji">{dimension?.emoji}</span>
          <h1 className="area-detail-title">{dimension?.label ?? key}</h1>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="section-head">
        <h2>Mis metas</h2>
        <button
          type="button"
          className="round-add-btn"
          onClick={() => setShowNewGoalForm((v) => !v)}
          aria-label={showNewGoalForm ? 'Cerrar formulario' : 'Nueva meta grande'}
          title={showNewGoalForm ? 'Cerrar' : 'Nueva meta grande'}
        >
          {showNewGoalForm ? <X size={18} strokeWidth={2.25} /> : <Plus size={18} strokeWidth={2.25} />}
        </button>
      </div>

      {showNewGoalForm && (
        <form className="area-form" onSubmit={handleCreateGoal}>
          <label>
            Texto
            <input name="text" type="text" required maxLength={MAX_GOAL_TEXT_LENGTH} />
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
        {goals.map((goal) => (
          <li key={goal.id}>
            <Link
              to={`/areas/${key}/${goal.id}`}
              className={`goal-card${goal.completed ? ' completed' : ''}`}
              style={{ ['--area-color' as string]: dimColor }}
            >
              <span className="goal-card-emoji" style={{ background: pastelOf(dimColor) }}>
                {goal.icon_emoji || dimension?.emoji}
              </span>
              <span className="goal-card-title">{goal.text}</span>
              <ChevronRight size={22} strokeWidth={2.25} className="goal-card-arrow" />
            </Link>
          </li>
        ))}
        {goals.length === 0 && <li className="subgoal-empty">Sin metas todavía</li>}
      </ul>

      {user && key && (
        <AffirmationPlaylist
          userId={user.id}
          dimensionKey={key}
          title="Mi visión"
          emptyMessage="Todavía no tienes afirmaciones en esta área"
        />
      )}

      {user && key && <AreaResourcesSection userId={user.id} dimensionKey={key} />}
    </div>
  )
}
