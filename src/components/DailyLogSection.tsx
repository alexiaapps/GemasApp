import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { awardGemOnce } from '../lib/gems'
import { mondayOfWeek, toISODate, todayISO } from '../lib/date'
import { getNutritionRange, upsertNutritionField, type NutritionDaily } from '../lib/nutrition'

const BELOW_LIST_BATCH = 4

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

interface DayCell {
  date: string
  dateObj: Date
  isFuture: boolean
  isToday: boolean
  entry: NutritionDaily | null
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
  const currentMonday = useMemo(() => mondayOfWeek(new Date(`${today}T00:00:00`)), [today])

  function weekStartForOffset(offset: number): Date {
    const d = new Date(currentMonday)
    d.setDate(d.getDate() - offset * 7)
    return d
  }

  const [error, setError] = useState<string | null>(null)
  const [entriesByDate, setEntriesByDate] = useState<Record<string, NutritionDaily>>({})
  const [rowEdits, setRowEdits] = useState<Record<string, RowEdit>>({})
  const [activeOffset, setActiveOffset] = useState(0)
  const [belowCount, setBelowCount] = useState(BELOW_LIST_BATCH)
  const [loadedOffsets, setLoadedOffsets] = useState<Set<number>>(new Set())
  const [loadingRange, setLoadingRange] = useState(false)
  const loadedOffsetsRef = useRef(loadedOffsets)
  loadedOffsetsRef.current = loadedOffsets

  function setActiveWeek(offset: number) {
    setActiveOffset(Math.max(0, offset))
    setBelowCount(BELOW_LIST_BATCH)
  }

  useEffect(() => {
    if (!user) return
    const needed = Array.from({ length: belowCount + 1 }, (_, i) => activeOffset + i)
    const missing = needed.filter((o) => !loadedOffsetsRef.current.has(o))
    if (missing.length === 0) return

    let cancelled = false
    const minOffset = Math.min(...missing)
    const maxOffset = Math.max(...missing)
    const rangeStart = weekStartForOffset(maxOffset)
    const rangeEndFull = weekStartForOffset(minOffset)
    rangeEndFull.setDate(rangeEndFull.getDate() + 6)
    const rangeEnd = toISODate(rangeEndFull) > today ? today : toISODate(rangeEndFull)

    setLoadingRange(true)
    getNutritionRange(user.id, toISODate(rangeStart), rangeEnd)
      .then((rows) => {
        if (cancelled) return
        setEntriesByDate((prev) => {
          const next = { ...prev }
          for (const row of rows) next[row.log_date] = row
          return next
        })
        setLoadedOffsets((prev) => {
          const next = new Set(prev)
          for (let o = minOffset; o <= maxOffset; o++) next.add(o)
          return next
        })
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoadingRange(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeOffset, belowCount, today])

  function buildWeekDays(offset: number): DayCell[] {
    const weekStart = weekStartForOffset(offset)
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
        entry: entriesByDate[iso] ?? null,
      })
    }
    return days
  }

  function weekSummary(days: DayCell[]) {
    const weights = days.map((d) => d.entry?.weight).filter((w): w is number => w != null)
    const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null
    const proteinCount = days.filter((d) => d.entry?.protein_goal_met).length
    const stepsCount = days.filter((d) => d.entry?.steps_goal_met).length
    const hasAnyData = days.some((d) => d.entry != null)
    return { avgWeight, proteinCount, stepsCount, hasAnyData }
  }

  function updateLocalEntry(date: string, patch: Partial<NutritionDaily>) {
    if (!user) return
    setEntriesByDate((prev) => ({
      ...prev,
      [date]: { ...(prev[date] ?? emptyEntry(user.id, date)), ...patch },
    }))
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

  const activeDays = buildWeekDays(activeOffset)
  const activeLoaded = loadedOffsets.has(activeOffset)
  const belowOffsets = Array.from({ length: belowCount }, (_, i) => activeOffset + 1 + i)

  return (
    <section className="daily-log-section">
      <h2>Bitácora</h2>
      {error && <p className="auth-error">{error}</p>}

      <div className="bitacora-week-nav">
        <button
          type="button"
          className="bitacora-week-nav-btn"
          onClick={() => setActiveWeek(activeOffset + 1)}
          aria-label="Semana anterior"
        >
          <ChevronLeft size={16} strokeWidth={1.75} /> Semana anterior
        </button>
        <button
          type="button"
          className="bitacora-week-nav-btn"
          onClick={() => setActiveWeek(activeOffset - 1)}
          disabled={activeOffset === 0}
          aria-label="Semana siguiente"
        >
          Semana siguiente <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>

      <p className="bitacora-active-week-label">
        {activeOffset === 0 ? 'Semana actual' : formatWeekRangeLabel(weekStartForOffset(activeOffset))}
      </p>

      {!activeLoaded && loadingRange ? (
        <p>Cargando...</p>
      ) : (
        <div className="bitacora-table">
          <div className="bitacora-table-header">
            <span>Día</span>
            <span>Peso (kg)</span>
            <span title="10,000 pasos">Pasos</span>
            <span>Km</span>
            <span title="170 g de proteína">Proteína</span>
          </div>

          {activeDays.map((day) => (
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

      <div className="bitacora-week-list">
        {belowOffsets.map((offset) => {
          const days = buildWeekDays(offset)
          const summary = weekSummary(days)
          return (
            <button
              key={offset}
              type="button"
              className="bitacora-week-summary-row"
              onClick={() => setActiveWeek(offset)}
            >
              <span className="bitacora-week-name">{formatWeekRangeLabel(weekStartForOffset(offset))}</span>
              <span className="bitacora-week-summary">
                {summary.hasAnyData
                  ? `${summary.avgWeight != null ? `${summary.avgWeight.toFixed(1)} kg prom. · ` : ''}${summary.proteinCount}/7 proteína · ${summary.stepsCount}/7 pasos`
                  : 'Sin datos'}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="bitacora-load-more-btn"
        onClick={() => setBelowCount((c) => c + BELOW_LIST_BATCH)}
      >
        Ver semanas anteriores
      </button>
    </section>
  )
}
