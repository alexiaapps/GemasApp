import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { awardGemOnce } from '../lib/gems'
import {
  getLastNDays,
  getNutritionDay,
  toISODate,
  todayISO,
  upsertNutritionField,
  type NutritionDaily,
} from '../lib/nutrition'

export default function DailyLogSection() {
  const { user } = useAuth()
  const today = todayISO()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [proteinMet, setProteinMet] = useState(false)
  const [stepsMet, setStepsMet] = useState(false)
  const [kmRun, setKmRun] = useState('')
  const [weight, setWeight] = useState('')

  const [last7Days, setLast7Days] = useState<NutritionDaily[]>([])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [todayRow, history] = await Promise.all([
          getNutritionDay(user!.id, today),
          getLastNDays(user!.id, 7),
        ])
        if (cancelled) return

        if (todayRow) {
          setProteinMet(todayRow.protein_goal_met ?? false)
          setStepsMet(todayRow.steps_goal_met ?? false)
          setKmRun(todayRow.km_run != null ? String(todayRow.km_run) : '')
          setWeight(todayRow.weight != null ? String(todayRow.weight) : '')
        }
        setLast7Days(history)
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
  }, [user, today])

  async function handleProteinToggle(checked: boolean) {
    if (!user) return
    setProteinMet(checked)
    try {
      await upsertNutritionField(user.id, today, { protein_goal_met: checked })
      if (checked) {
        await awardGemOnce(user.id, 5, 'fisico', 'protein', today)
      }
    } catch (e) {
      setError((e as Error).message)
      setProteinMet(!checked)
    }
  }

  async function handleStepsToggle(checked: boolean) {
    if (!user) return
    setStepsMet(checked)
    try {
      await upsertNutritionField(user.id, today, { steps_goal_met: checked })
      if (checked) {
        await awardGemOnce(user.id, 2, 'fisico', 'steps', today)
      }
    } catch (e) {
      setError((e as Error).message)
      setStepsMet(!checked)
    }
  }

  async function handleKmRunBlur() {
    if (!user) return
    const value = kmRun.trim() === '' ? null : Number(kmRun)
    try {
      await upsertNutritionField(user.id, today, { km_run: value })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleWeightBlur() {
    if (!user) return
    const value = weight.trim() === '' ? null : Number(weight)
    try {
      await upsertNutritionField(user.id, today, { weight: value })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (loading) {
    return (
      <section className="daily-log-section">
        <h2>Bitácora</h2>
        <p>Cargando...</p>
      </section>
    )
  }

  return (
    <section className="daily-log-section">
      <h2>Bitácora</h2>

      {error && <p className="auth-error">{error}</p>}

      <div className="bitacora-today">
        <label className="bitacora-checkbox">
          <input
            type="checkbox"
            checked={proteinMet}
            onChange={(e) => handleProteinToggle(e.target.checked)}
          />
          170 g de proteína
        </label>

        <label className="bitacora-checkbox">
          <input
            type="checkbox"
            checked={stepsMet}
            onChange={(e) => handleStepsToggle(e.target.checked)}
          />
          10,000 pasos
        </label>

        <label className="bitacora-field">
          Km corridos
          <input
            type="number"
            step="0.1"
            min="0"
            value={kmRun}
            onChange={(e) => setKmRun(e.target.value)}
            onBlur={handleKmRunBlur}
          />
        </label>

        <label className="bitacora-field">
          Peso (kg)
          <input
            type="number"
            step="0.1"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={handleWeightBlur}
          />
        </label>
      </div>

      <h3>Últimos 7 días</h3>
      <ul className="bitacora-history">
        {buildLast7DaysView(last7Days, today).map(({ date, entry }) => (
          <li key={date}>
            <strong>{date}</strong>{' '}
            {entry ? (
              <span>
                {entry.protein_goal_met ? '✅ proteína' : '⬜ proteína'} ·{' '}
                {entry.steps_goal_met ? '✅ pasos' : '⬜ pasos'} ·{' '}
                {entry.km_run != null ? `${entry.km_run} km` : 'sin km'} ·{' '}
                {entry.weight != null ? `${entry.weight} kg` : 'sin peso'}
              </span>
            ) : (
              <span>Sin datos</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function buildLast7DaysView(entries: NutritionDaily[], today: string) {
  const byDate = new Map(entries.map((e) => [e.log_date, e]))
  const days: { date: string; entry: NutritionDaily | null }[] = []
  const base = new Date(`${today}T00:00:00`)

  for (let i = 0; i < 7; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    const iso = toISODate(d)
    days.push({ date: iso, entry: byDate.get(iso) ?? null })
  }
  return days
}
