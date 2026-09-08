import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { awardGemOnce } from '../lib/gems'
import { mondayOfWeek, toISODate, todayISO } from '../lib/date'
import { getLastNDays, upsertNutritionField, type NutritionDaily } from '../lib/nutrition'

const WEEKS_SHOWN = 4
const HISTORY_DAYS = 30

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

interface DayCell {
  date: string
  dateObj: Date
  isFuture: boolean
  isToday: boolean
  entry: NutritionDaily | null
}

interface WeekGroup {
  weekStart: Date
  days: DayCell[]
}

interface RowEdit {
  weight?: string
  km?: string
}

function formatDayLabel(d: Date): string {
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`
}

function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${weekStart.getDate()} – ${weekEnd.getDate()} ${MONTH_LABELS[weekStart.getMonth()]}`
  }
  return `${weekStart.getDate()} ${MONTH_LABELS[weekStart.getMonth()]} – ${weekEnd.getDate()} ${MONTH_LABELS[weekEnd.getMonth()]}`
}

function emptyEntry(userId: string, date: string): NutritionDaily {
  return { user_id: userId, log_date: date, protein_goal_met: false, steps_goal_met: false, km_run: null, weight: null }
}

export default function DailyLogSection() {
  const { user } = useAuth()
  const today = todayISO()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<NutritionDaily[]>([])
  const [rowEdits, setRowEdits] = useState<Record<string, RowEdit>>({})
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(
    () => new Set(Array.from({ length: WEEKS_SHOWN - 1 }, (_, i) => i + 1)),
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await getLastNDays(user!.id, HISTORY_DAYS)
        if (!cancelled) setHistory(data)
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
  }, [user])

  const weeks = useMemo<WeekGroup[]>(() => {
    const todayDate = new Date(`${today}T00:00:00`)
    const currentMonday = mondayOfWeek(todayDate)
    const historyMap = new Map(history.map((e) => [e.log_date, e]))

    const result: WeekGroup[] = []
    for (let w = 0; w < WEEKS_SHOWN; w++) {
      const weekStart = new Date(currentMonday)
      weekStart.setDate(weekStart.getDate() - w * 7)

      const days: DayCell[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + i)
        const iso = toISODate(d)
        days.push({
          date: iso,
          dateObj: d,
          isFuture: iso > today,
          isToday: iso === today,
          entry: historyMap.get(iso) ?? null,
        })
      }
      result.push({ weekStart, days })
    }
    return result
  }, [history, today])

  function toggleWeek(idx: number) {
    setCollapsedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function updateLocalEntry(date: string, patch: Partial<NutritionDaily>) {
    if (!user) return
    setHistory((prev) => {
      const idx = prev.findIndex((e) => e.log_date === date)
      if (idx === -1) return [...prev, { ...emptyEntry(user.id, date), ...patch }]
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  function updateRowEdit(date: string, patch: RowEdit) {
    setRowEdits((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }))
  }

  function getWeightValue(date: string, entry: NutritionDaily | null): string {
    const edit = rowEdits[date]?.weight
    if (edit !== undefined) return edit
    return entry?.weight != null ? String(entry.weight) : ''
  }

  function getKmValue(date: string, entry: NutritionDaily | null): string {
    const edit = rowEdits[date]?.km
    if (edit !== undefined) return edit
    return entry?.km_run != null ? String(entry.km_run) : ''
  }

  async function handleWeightBlur(date: string) {
    if (!user) return
    const value = rowEdits[date]?.weight
    if (value === undefined) return
    const parsed = value.trim() === '' ? null : Number(value)
    try {
      await upsertNutritionField(user.id, date, { weight: parsed })
      updateLocalEntry(date, { weight: parsed })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleKmBlur(date: string) {
    if (!user) return
    const value = rowEdits[date]?.km
    if (value === undefined) return
    const parsed = value.trim() === '' ? null : Number(value)
    try {
      await upsertNutritionField(user.id, date, { km_run: parsed })
      updateLocalEntry(date, { km_run: parsed })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleProteinToggle(date: string, checked: boolean) {
    if (!user) return
    updateLocalEntry(date, { protein_goal_met: checked })
    try {
      await upsertNutritionField(user.id, date, { protein_goal_met: checked })
      if (checked) await awardGemOnce(user.id, 5, 'fisico', 'protein', date)
    } catch (e) {
      setError((e as Error).message)
      updateLocalEntry(date, { protein_goal_met: !checked })
    }
  }

  async function handleStepsToggle(date: string, checked: boolean) {
    if (!user) return
    updateLocalEntry(date, { steps_goal_met: checked })
    try {
      await upsertNutritionField(user.id, date, { steps_goal_met: checked })
      if (checked) await awardGemOnce(user.id, 2, 'fisico', 'steps', date)
    } catch (e) {
      setError((e as Error).message)
      updateLocalEntry(date, { steps_goal_met: !checked })
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

      <div className="bitacora-week-stack">
        {weeks.map((week, idx) => {
          const collapsed = collapsedWeeks.has(idx)
          const weights = week.days.map((d) => d.entry?.weight).filter((w): w is number => w != null)
          const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null
          const proteinCount = week.days.filter((d) => d.entry?.protein_goal_met).length
          const stepsCount = week.days.filter((d) => d.entry?.steps_goal_met).length
          const hasAnyData = week.days.some((d) => d.entry != null)

          return (
            <div key={toISODate(week.weekStart)} className="bitacora-week">
              <button type="button" className="bitacora-week-header" onClick={() => toggleWeek(idx)}>
                <span className="bitacora-week-title">
                  <span className="bitacora-week-name">
                    {idx === 0 ? 'Semana actual' : formatWeekRangeLabel(week.weekStart)}
                  </span>
                  {collapsed && hasAnyData && (
                    <span className="bitacora-week-summary">
                      {avgWeight != null ? `${avgWeight.toFixed(1)} kg prom. · ` : ''}
                      {proteinCount}/7 proteína · {stepsCount}/7 pasos
                    </span>
                  )}
                </span>
                <span className="bitacora-week-chevron">
                  {collapsed ? (
                    <ChevronRight size={18} strokeWidth={1.75} />
                  ) : (
                    <ChevronDown size={18} strokeWidth={1.75} />
                  )}
                </span>
              </button>

              {!collapsed && (
                <div className="bitacora-table">
                  <div className="bitacora-table-header">
                    <span>Día</span>
                    <span>Peso (kg)</span>
                    <span title="10,000 pasos">Pasos</span>
                    <span>Km</span>
                    <span title="170 g de proteína">Proteína</span>
                  </div>

                  {week.days.map((day) => (
                    <div
                      key={day.date}
                      className={`bitacora-table-row${day.isFuture ? ' future' : ''}${day.isToday ? ' today' : ''}`}
                    >
                      <span className="bitacora-day-label">{formatDayLabel(day.dateObj)}</span>

                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="—"
                        className="bitacora-table-input"
                        disabled={day.isFuture}
                        value={getWeightValue(day.date, day.entry)}
                        onChange={(e) => updateRowEdit(day.date, { weight: e.target.value })}
                        onBlur={() => handleWeightBlur(day.date)}
                      />

                      <button
                        type="button"
                        className={`bitacora-toggle-circle${day.entry?.steps_goal_met ? ' active' : ''}`}
                        disabled={day.isFuture}
                        onClick={() => handleStepsToggle(day.date, !day.entry?.steps_goal_met)}
                        aria-label="10,000 pasos"
                        title="10,000 pasos"
                      >
                        {day.entry?.steps_goal_met && <Check size={14} strokeWidth={2.5} />}
                      </button>

                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="—"
                        className="bitacora-table-input"
                        disabled={day.isFuture}
                        value={getKmValue(day.date, day.entry)}
                        onChange={(e) => updateRowEdit(day.date, { km: e.target.value })}
                        onBlur={() => handleKmBlur(day.date)}
                      />

                      <button
                        type="button"
                        className={`bitacora-toggle-circle${day.entry?.protein_goal_met ? ' active' : ''}`}
                        disabled={day.isFuture}
                        onClick={() => handleProteinToggle(day.date, !day.entry?.protein_goal_met)}
                        aria-label="170 g de proteína"
                        title="170 g de proteína"
                      >
                        {day.entry?.protein_goal_met && <Check size={14} strokeWidth={2.5} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
