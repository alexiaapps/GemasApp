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
  weightUnit: WeightUnit
  rir: string
}

function rowKey(exerciseId: string, setNumber: number) {
  return `${exerciseId}-${setNumber}`
}

function defaultRowState(): RowState {
  return { reps: '', durationSec: '', weight: '', weightUnit: 'kg', rir: '' }
}

export default function TrainingSession() {
  const { dayId } = useParams<{ dayId: string }>()
  const { user } = useAuth()

  const [day, setDay] = useState<DayWithExercises | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [loggedSets, setLoggedSets] = useState<Map<string, ExerciseLog>>(new Map())
  const [rowInputs, setRowInputs] = useState<Record<string, RowState>>({})
  const [notesByExercise, setNotesByExercise] = useState<Record<string, string>>({})
  const [progressMessages, setProgressMessages] = useState<Record<string, string | null>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [activeTimer, setActiveTimer] = useState<{ key: string; seconds: number } | null>(null)
  const [dayCompleted, setDayCompleted] = useState(false)
  const [weekBonusMessage, setWeekBonusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!dayId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId])

  async function load() {
    if (!dayId) return
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
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const totalSets = useMemo(
    () => (day ? day.day_exercises.reduce((sum, ex) => sum + ex.sets, 0) : 0),
    [day],
  )

  function getRowState(key: string): RowState {
    return rowInputs[key] ?? defaultRowState()
  }

  function updateRow(key: string, patch: Partial<RowState>) {
    setRowInputs((prev) => ({ ...prev, [key]: { ...getRowState(key), ...patch } }))
  }

  async function handleRegisterSet(exercise: DayExercise, setNumber: number) {
    if (!user || !day) return
    const key = rowKey(exercise.exercise_id, setNumber)
    const row = getRowState(key)
    const exerciseType = exercise.exercise?.default_type ?? 'reps'
    const isLastSetOfExercise = setNumber === exercise.sets

    setSavingKey(key)
    setError(null)
    try {
      const previous = await getMostRecentLogForSet(user.id, exercise.exercise_id, setNumber)

      const current = {
        reps: exerciseType === 'reps' && row.reps.trim() !== '' ? Number(row.reps) : null,
        durationSec: exerciseType === 'time' && row.durationSec.trim() !== '' ? Number(row.durationSec) : null,
        weight: row.weight.trim() !== '' ? Number(row.weight) : null,
        weightUnit: row.weight.trim() !== '' ? row.weightUnit : null,
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

      if (nextLoggedSets.size === totalSets && !dayCompleted) {
        await markDayCompleted(day.id)
        await awardGemOnce(user.id, 5, 'fisico', 'session', day.id)
        setDayCompleted(true)

        const weekDone = await isWeekFullyCompleted(day.program_id, day.week)
        if (weekDone) {
          await awardGemOnce(user.id, 10, 'fisico', 'week_bonus', `${day.program_id}_w${day.week}`)
          setWeekBonusMessage('¡Completaste toda la semana! +10 gemas extra 💎')
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingKey(null)
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
    <div className="page">
      <Link to={`/entrenamiento/${day.program_id}`} className="area-back">
        ← Volver al programa
      </Link>

      <h1>{day.label ?? `Día ${day.day_number}`}</h1>
      {error && <p className="auth-error">{error}</p>}

      {dayCompleted && (
        <p className="training-day-complete">
          ✅ Día completado {weekBonusMessage ? `· ${weekBonusMessage}` : '· +5 gemas'}
        </p>
      )}

      {[...day.day_exercises]
        .sort((a, b) => a.order_index - b.order_index)
        .map((exercise) => {
          const exerciseType = exercise.exercise?.default_type ?? 'reps'
          const lastSetKey = rowKey(exercise.exercise_id, exercise.sets)
          const exerciseFullyLogged = loggedSets.has(lastSetKey)

          return (
            <div key={exercise.id} className="training-exercise-card">
              <h3>{exercise.exercise?.name ?? 'Ejercicio'}</h3>
              <p className="auth-subtitle">
                {exercise.sets} sets · {exercise.target_reps}
                {exercise.rir != null ? ` · RIR objetivo ${exercise.rir}` : ''}
                {exercise.rest_seconds != null ? ` · ${exercise.rest_seconds}s descanso` : ''}
              </p>

              <label className="training-notes-label">
                Notas del ejercicio (opcional)
                <textarea
                  rows={2}
                  disabled={exerciseFullyLogged}
                  value={notesByExercise[exercise.exercise_id] ?? ''}
                  onChange={(e) =>
                    setNotesByExercise((prev) => ({ ...prev, [exercise.exercise_id]: e.target.value }))
                  }
                />
              </label>

              <ul className="training-set-list">
                {Array.from({ length: exercise.sets }, (_, i) => i + 1).map((setNumber) => {
                  const key = rowKey(exercise.exercise_id, setNumber)
                  const logged = loggedSets.get(key)
                  const row = getRowState(key)
                  const message = progressMessages[key]

                  if (logged) {
                    return (
                      <li key={key} className="training-set-row logged">
                        <span>Set {setNumber}: </span>
                        {exerciseType === 'reps' ? (
                          <span>
                            {logged.reps ?? '—'} reps
                            {logged.weight != null ? ` · ${logged.weight}${logged.weight_unit}` : ''}
                            {logged.rir != null ? ` · RIR ${logged.rir}` : ''}
                          </span>
                        ) : (
                          <span>
                            {logged.duration_sec ?? '—'}s
                            {logged.weight != null ? ` · ${logged.weight}${logged.weight_unit}` : ''}
                          </span>
                        )}
                        {message && <span className="training-progress-badge">{message}</span>}
                        <span className="training-set-check">✓</span>
                      </li>
                    )
                  }

                  return (
                    <li key={key} className="training-set-row">
                      <span className="training-set-number">Set {setNumber}</span>

                      {exerciseType === 'reps' ? (
                        <input
                          type="number"
                          placeholder="Reps"
                          className="training-input-sm"
                          value={row.reps}
                          onChange={(e) => updateRow(key, { reps: e.target.value })}
                        />
                      ) : (
                        <input
                          type="number"
                          placeholder="Segundos"
                          className="training-input-sm"
                          value={row.durationSec}
                          onChange={(e) => updateRow(key, { durationSec: e.target.value })}
                        />
                      )}

                      <input
                        type="number"
                        placeholder="Peso"
                        className="training-input-sm"
                        value={row.weight}
                        onChange={(e) => updateRow(key, { weight: e.target.value })}
                      />
                      <select
                        value={row.weightUnit}
                        onChange={(e) => updateRow(key, { weightUnit: e.target.value as WeightUnit })}
                      >
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                      </select>

                      {exerciseType === 'reps' && (
                        <input
                          type="number"
                          placeholder="RIR"
                          className="training-input-sm"
                          value={row.rir}
                          onChange={(e) => updateRow(key, { rir: e.target.value })}
                        />
                      )}

                      <button
                        type="button"
                        className="training-check-btn"
                        onClick={() => handleRegisterSet(exercise, setNumber)}
                        disabled={savingKey === key}
                      >
                        {savingKey === key ? '…' : '✓'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}

      {activeTimer && (
        <div className="rest-timer-wrapper">
          <RestTimer
            key={activeTimer.key}
            seconds={activeTimer.seconds}
            onDone={() => setActiveTimer(null)}
          />
        </div>
      )}
    </div>
  )
}
