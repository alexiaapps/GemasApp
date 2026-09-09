import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  History,
  Layers,
  Loader2,
  RotateCcw,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import RestTimer from '../components/RestTimer'
import { awardGemOnce } from '../lib/gems'
import {
  compareSetProgress,
  getLogsForProgramDay,
  getMostRecentLogForSet,
  logSet,
  type ExerciseLog,
} from '../lib/exerciseLogs'
import { getProgramDay, isWeekFullyCompleted, markDayCompleted, type DayExercise, type ProgramDay } from '../lib/programs'
import type { WeightUnit } from '../lib/units'

type DayWithExercises = ProgramDay & { day_exercises: DayExercise[] }

interface RowState {
  reps: string
  durationSec: string
  weight: string
  rir: string
}

function rowKey(exerciseId: string, setNumber: number) {
  return `${exerciseId}-${setNumber}`
}

function defaultRowState(): RowState {
  return { reps: '', durationSec: '', weight: '', rir: '' }
}

function formatRestLabel(seconds: number | null): string {
  if (seconds == null) return '—'
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`
  return `${seconds}s`
}

export default function TrainingSession() {
  const { dayId } = useParams<{ dayId: string }>()
  const { user } = useAuth()

  const [day, setDay] = useState<DayWithExercises | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [loggedSets, setLoggedSets] = useState<Map<string, ExerciseLog>>(new Map())
  const [previousSets, setPreviousSets] = useState<Map<string, ExerciseLog>>(new Map())
  const [rowInputs, setRowInputs] = useState<Record<string, RowState>>({})
  const [unitByExercise, setUnitByExercise] = useState<Record<string, WeightUnit>>({})
  const [notesByExercise, setNotesByExercise] = useState<Record<string, string>>({})
  const [progressMessages, setProgressMessages] = useState<Record<string, string | null>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [activeTimer, setActiveTimer] = useState<{ key: string; seconds: number } | null>(null)
  const [dayCompleted, setDayCompleted] = useState(false)
  const [weekBonusMessage, setWeekBonusMessage] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    if (!dayId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId])

  async function load() {
    if (!dayId || !user) return
    setLoading(true)
    setError(null)
    try {
      const [dayData, logs] = await Promise.all([getProgramDay(dayId), getLogsForProgramDay(dayId)])
      setDay(dayData)
      setDayCompleted(dayData.completed)

      const map = new Map<string, ExerciseLog>()
      for (const log of logs) {
        map.set(rowKey(log.exercise_id, log.set_number), log)
      }
      setLoggedSets(map)

      // "Sem. anterior": el log más reciente de cada exercise+set, de cualquier sesión pasada.
      const lookups: Promise<void>[] = []
      const prevMap = new Map<string, ExerciseLog>()
      for (const ex of dayData.day_exercises) {
        for (let setNumber = 1; setNumber <= ex.sets; setNumber++) {
          lookups.push(
            getMostRecentLogForSet(user.id, ex.exercise_id, setNumber).then((prev) => {
              if (prev) prevMap.set(rowKey(ex.exercise_id, setNumber), prev)
            }),
          )
        }
      }
      await Promise.all(lookups)
      setPreviousSets(prevMap)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const totalExercises = day?.day_exercises.length ?? 0
  const completedExercises = useMemo(() => {
    if (!day) return 0
    return day.day_exercises.filter((ex) => loggedSets.has(rowKey(ex.exercise_id, ex.sets))).length
  }, [day, loggedSets])

  function getRowState(key: string): RowState {
    return rowInputs[key] ?? defaultRowState()
  }

  function updateRow(key: string, patch: Partial<RowState>) {
    setRowInputs((prev) => ({ ...prev, [key]: { ...getRowState(key), ...patch } }))
  }

  function getUnit(exerciseId: string): WeightUnit {
    return unitByExercise[exerciseId] ?? 'kg'
  }

  async function handleRegisterSet(exercise: DayExercise, setNumber: number) {
    if (!user || !day) return
    const key = rowKey(exercise.exercise_id, setNumber)
    const row = getRowState(key)
    const exerciseType = exercise.exercise?.default_type ?? 'reps'
    const unit = getUnit(exercise.exercise_id)
    const isLastSetOfExercise = setNumber === exercise.sets

    setSavingKey(key)
    setError(null)
    try {
      const previous = await getMostRecentLogForSet(user.id, exercise.exercise_id, setNumber)

      const current = {
        reps: exerciseType === 'reps' && row.reps.trim() !== '' ? Number(row.reps) : null,
        durationSec: exerciseType === 'time' && row.durationSec.trim() !== '' ? Number(row.durationSec) : null,
        weight: row.weight.trim() !== '' ? Number(row.weight) : null,
        weightUnit: row.weight.trim() !== '' ? unit : null,
        rir: exerciseType === 'reps' && row.rir.trim() !== '' ? Number(row.rir) : null,
        notes: isLastSetOfExercise ? (notesByExercise[exercise.exercise_id]?.trim() || null) : null,
      }

      const message = compareSetProgress(exerciseType, previous, current)

      const savedLog = await logSet(
        user.id,
        day.program_id,
        day.id,
        exercise.exercise_id,
        setNumber,
        current,
      )

      const nextLoggedSets = new Map(loggedSets)
      nextLoggedSets.set(key, savedLog)
      setLoggedSets(nextLoggedSets)
      setProgressMessages((prev) => ({ ...prev, [key]: message }))

      if (exercise.rest_seconds != null && exercise.rest_seconds > 0) {
        setActiveTimer({ key: `${key}-${Date.now()}`, seconds: exercise.rest_seconds })
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingKey(null)
    }
  }

  async function handleFinishSession() {
    if (!user || !day || dayCompleted || finishing) return

    if (loggedSets.size === 0) {
      const confirmed = window.confirm('¿Seguro? No registraste ningún ejercicio.')
      if (!confirmed) return
    }

    setFinishing(true)
    setError(null)
    try {
      await markDayCompleted(day.id)
      await awardGemOnce(user.id, 5, 'fisico', 'session', day.id)
      setDayCompleted(true)

      const weekDone = await isWeekFullyCompleted(day.program_id, day.week)
      if (weekDone) {
        await awardGemOnce(user.id, 10, 'fisico', 'week_bonus', `${day.program_id}_w${day.week}`)
        setWeekBonusMessage('¡Completaste toda la semana! +10 gemas extra 💎')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setFinishing(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Cargando...</p>
      </div>
    )
  }

  if (!day) {
    return (
      <div className="page">
        <p>Día no encontrado.</p>
      </div>
    )
  }

  return (
    <div className="page training-page">
      <div className="training-header">
        <Link to={`/entrenamiento/${day.program_id}`} className="training-header-back" aria-label="Volver">
          <ArrowLeft size={22} strokeWidth={1.75} />
        </Link>
        <span className="training-header-title">{day.label ?? `Día ${day.day_number}`}</span>
        <Link to={`/entrenamiento/${day.program_id}`} className="training-header-finish">
          <CheckCircle2 size={16} strokeWidth={1.75} />
          Finalizar
        </Link>
      </div>

      <div className="training-counter-row">
        <span className="training-exercise-counter">
          {completedExercises}/{totalExercises} ejercicios
        </span>
        <RestTimer
          seconds={activeTimer?.seconds ?? null}
          resetKey={activeTimer?.key}
          onDone={() => setActiveTimer(null)}
        />
      </div>

      {error && <p className="auth-error">{error}</p>}

      {dayCompleted && (
        <p className="training-day-complete">
          <CheckCircle2 size={16} strokeWidth={1.75} /> Día completado{' '}
          {weekBonusMessage ? `· ${weekBonusMessage}` : '· +5 gemas'}
        </p>
      )}

      {[...day.day_exercises]
        .sort((a, b) => a.order_index - b.order_index)
        .map((exercise) => {
          const exerciseType = exercise.exercise?.default_type ?? 'reps'
          const lastSetKey = rowKey(exercise.exercise_id, exercise.sets)
          const exerciseFullyLogged = loggedSets.has(lastSetKey)
          const unit = getUnit(exercise.exercise_id)

          const previousLines = Array.from({ length: exercise.sets }, (_, i) => i + 1)
            .map((setNumber) => ({ setNumber, prev: previousSets.get(rowKey(exercise.exercise_id, setNumber)) }))
            .filter((row): row is { setNumber: number; prev: ExerciseLog } => row.prev != null)

          return (
            <div key={exercise.id} className="training-exercise-card">
              <div className="training-exercise-title-row">
                <h3 className="training-exercise-title">{exercise.exercise?.name ?? 'Ejercicio'}</h3>
              </div>

              <div className="training-stats-row">
                <div className="training-stat">
                  <Layers size={16} strokeWidth={1.75} />
                  <span className="training-stat-label">Series</span>
                  <span className="training-stat-value">{exercise.sets}</span>
                </div>
                <div className="training-stat">
                  <RotateCcw size={16} strokeWidth={1.75} />
                  <span className="training-stat-label">{exerciseType === 'time' ? 'Segundos' : 'Reps'}</span>
                  <span className="training-stat-value">{exercise.target_reps}</span>
                </div>
                {exerciseType === 'reps' && exercise.rir != null && (
                  <div className="training-stat">
                    <Zap size={16} strokeWidth={1.75} />
                    <span className="training-stat-label">RIR</span>
                    <span className="training-stat-value">{exercise.rir}</span>
                  </div>
                )}
                <div className="training-stat">
                  <Clock size={16} strokeWidth={1.75} />
                  <span className="training-stat-label">Descanso</span>
                  <span className="training-stat-value">{formatRestLabel(exercise.rest_seconds)}</span>
                </div>
              </div>

              {previousLines.length > 0 && (
                <div className="training-previous-section">
                  <p className="training-previous-label">
                    <History size={13} strokeWidth={1.75} /> Sem. anterior
                  </p>
                  {previousLines.map(({ setNumber, prev }) => (
                    <p key={setNumber} className="training-previous-line">
                      S{setNumber} · {prev.weight != null ? `${prev.weight}${prev.weight_unit}` : 'sin peso'} ·{' '}
                      {exerciseType === 'time' ? `${prev.duration_sec ?? '—'}s` : `${prev.reps ?? '—'}r`}
                      {prev.rir != null ? ` · RIR ${prev.rir}` : ''}
                    </p>
                  ))}
                </div>
              )}

              <div className="training-grid">
                <div className="training-grid-header">
                  <span className="training-grid-col-serie">Serie</span>
                  <span className="training-grid-col-peso">
                    Peso
                    <span className="training-unit-toggle">
                      <button
                        type="button"
                        className={unit === 'kg' ? 'active' : ''}
                        onClick={() => setUnitByExercise((prev) => ({ ...prev, [exercise.exercise_id]: 'kg' }))}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        className={unit === 'lb' ? 'active' : ''}
                        onClick={() => setUnitByExercise((prev) => ({ ...prev, [exercise.exercise_id]: 'lb' }))}
                      >
                        lb
                      </button>
                    </span>
                  </span>
                  <span>{exerciseType === 'time' ? 'Segundos' : 'Reps'}</span>
                  {exerciseType === 'reps' ? <span>RIR</span> : <span />}
                  <span />
                </div>

                {Array.from({ length: exercise.sets }, (_, i) => i + 1).map((setNumber) => {
                  const key = rowKey(exercise.exercise_id, setNumber)
                  const logged = loggedSets.get(key)
                  const row = getRowState(key)
                  const message = progressMessages[key]

                  if (logged) {
                    return (
                      <div key={key} className="training-grid-row logged">
                        <span className="training-grid-col-serie">{setNumber}</span>
                        <span className="training-grid-col-peso">
                          {logged.weight != null ? `${logged.weight}${logged.weight_unit}` : '—'}
                        </span>
                        <span>{exerciseType === 'time' ? logged.duration_sec ?? '—' : logged.reps ?? '—'}</span>
                        {exerciseType === 'reps' ? <span>{logged.rir ?? '—'}</span> : <span />}
                        <span className="training-set-check">
                          <Check size={16} strokeWidth={2.5} />
                        </span>
                        {message && <span className="training-progress-badge">{message}</span>}
                      </div>
                    )
                  }

                  return (
                    <div key={key} className="training-grid-row">
                      <span className="training-grid-col-serie">{setNumber}</span>
                      <input
                        type="number"
                        placeholder="—"
                        className="training-grid-input training-grid-col-peso"
                        value={row.weight}
                        onChange={(e) => updateRow(key, { weight: e.target.value })}
                      />
                      {exerciseType === 'reps' ? (
                        <input
                          type="number"
                          placeholder="—"
                          className="training-grid-input"
                          value={row.reps}
                          onChange={(e) => updateRow(key, { reps: e.target.value })}
                        />
                      ) : (
                        <input
                          type="number"
                          placeholder="—"
                          className="training-grid-input"
                          value={row.durationSec}
                          onChange={(e) => updateRow(key, { durationSec: e.target.value })}
                        />
                      )}
                      {exerciseType === 'reps' ? (
                        <input
                          type="number"
                          placeholder="—"
                          className="training-grid-input"
                          value={row.rir}
                          onChange={(e) => updateRow(key, { rir: e.target.value })}
                        />
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        className="training-check-btn"
                        onClick={() => handleRegisterSet(exercise, setNumber)}
                        disabled={savingKey === key}
                      >
                        {savingKey === key ? (
                          <Loader2 size={16} strokeWidth={1.75} className="icon-spin" />
                        ) : (
                          <Check size={16} strokeWidth={2.5} />
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>

              <textarea
                className="training-notes-textarea"
                rows={2}
                placeholder="Sensaciones, qué fue difícil, notas para el coach…"
                disabled={exerciseFullyLogged}
                value={notesByExercise[exercise.exercise_id] ?? ''}
                onChange={(e) =>
                  setNotesByExercise((prev) => ({ ...prev, [exercise.exercise_id]: e.target.value }))
                }
              />
            </div>
          )
        })}

      <div className="training-finish-bar">
        <button
          type="button"
          className={`training-finish-btn${dayCompleted ? ' done' : ''}`}
          onClick={handleFinishSession}
          disabled={dayCompleted || finishing}
        >
          {finishing ? (
            <Loader2 size={18} strokeWidth={1.75} className="icon-spin" />
          ) : (
            <CheckCircle2 size={18} strokeWidth={1.75} />
          )}
          {dayCompleted ? 'Sesión completada' : 'Finalizar sesión'}
        </button>
      </div>
    </div>
  )
}
