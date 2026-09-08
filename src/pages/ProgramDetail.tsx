import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DayEditor from '../components/DayEditor'
import {
  addExtraWeek,
  getProgram,
  listProgramDays,
  replaceDayExercises,
  type DayExercise,
  type DayExercisePlan,
  type Program,
  type ProgramDay,
} from '../lib/programs'

type DayWithExercises = ProgramDay & { day_exercises: DayExercise[] }

export default function ProgramDetail() {
  const { programId } = useParams<{ programId: string }>()
  const { user } = useAuth()

  const [program, setProgram] = useState<Program | null>(null)
  const [days, setDays] = useState<DayWithExercises[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set())
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const [addingWeek, setAddingWeek] = useState(false)

  useEffect(() => {
    if (!programId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId])

  async function load() {
    if (!programId) return
    setLoading(true)
    setError(null)
    try {
      const [programData, daysData] = await Promise.all([
        getProgram(programId),
        listProgramDays(programId),
      ])
      setProgram(programData)
      setDays(daysData)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function toggleWeek(week: number) {
    setCollapsedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(week)) next.delete(week)
      else next.add(week)
      return next
    })
  }

  async function handleAddExtraWeek() {
    if (!program) return
    setAddingWeek(true)
    setError(null)
    try {
      await addExtraWeek(program)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAddingWeek(false)
    }
  }

  async function handleSaveDayExercises(dayId: string, exercises: DayExercisePlan[]) {
    setError(null)
    try {
      await replaceDayExercises(dayId, exercises)
      setEditingDayId(null)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Cargando...</p>
      </div>
    )
  }

  if (!program) {
    return (
      <div className="page">
        <p>Programa no encontrado.</p>
      </div>
    )
  }

  const weeks = Array.from(new Set(days.map((d) => d.week))).sort((a, b) => a - b)
  const editingDay = days.find((d) => d.id === editingDayId) ?? null

  return (
    <div className="page">
      <Link to="/entrenamiento" className="area-back">
        ← Entrenamiento
      </Link>

      <h1>{program.name}</h1>
      {program.goal && <p className="auth-subtitle">{program.goal}</p>}
      {error && <p className="auth-error">{error}</p>}

      {program.status === 'active' && (
        <button type="button" className="area-new-goal-btn" onClick={handleAddExtraWeek} disabled={addingWeek}>
          {addingWeek ? 'Agregando...' : '+ Agregar semana extra'}
        </button>
      )}

      {weeks.map((week) => {
        const weekDays = days.filter((d) => d.week === week).sort((a, b) => a.day_number - b.day_number)
        const collapsed = collapsedWeeks.has(week)

        return (
          <div key={week} className="program-week">
            <button type="button" className="program-week-header" onClick={() => toggleWeek(week)}>
              <span>Semana {week}</span>
              <span>{collapsed ? '▼' : '▲'}</span>
            </button>

            {!collapsed && (
              <ul className="program-day-list">
                {weekDays.map((day) => (
                  <li key={day.id} className={`program-day-item${day.completed ? ' completed' : ''}`}>
                    <div className="program-day-header">
                      <span>{day.completed ? '✅' : '⬜'} {day.label ?? `Día ${day.day_number}`}</span>
                    </div>

                    {day.day_exercises.length > 0 ? (
                      <ul className="day-editor-list">
                        {[...day.day_exercises]
                          .sort((a, b) => a.order_index - b.order_index)
                          .map((ex) => (
                            <li key={ex.id} className="day-editor-item">
                              <span className="day-editor-item-text">
                                {ex.exercise?.name ?? 'Ejercicio'} · {ex.sets}×{ex.target_reps}
                                {ex.rir != null ? ` · RIR ${ex.rir}` : ''}
                                {ex.rest_seconds != null ? ` · ${ex.rest_seconds}s descanso` : ''}
                              </span>
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="subgoal-empty">Sin ejercicios</p>
                    )}

                    {!day.completed && (
                      <div className="program-day-actions">
                        <button type="button" onClick={() => setEditingDayId(day.id)}>
                          Editar
                        </button>
                        <Link to={`/entrenamiento/sesion/${day.id}`} className="program-day-train-link">
                          Ir a entrenar
                        </Link>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      {editingDay && user && (
        <div className="sheet-overlay" onClick={() => setEditingDayId(null)}>
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingDay.label ?? `Día ${editingDay.day_number}`}</h3>
            <DayEditorWrapper
              userId={user.id}
              day={editingDay}
              onSave={(exercises) => handleSaveDayExercises(editingDay.id, exercises)}
              onCancel={() => setEditingDayId(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function DayEditorWrapper({
  userId,
  day,
  onSave,
  onCancel,
}: {
  userId: string
  day: DayWithExercises
  onSave: (exercises: DayExercisePlan[]) => void
  onCancel: () => void
}) {
  const [exercises, setExercises] = useState<DayExercisePlan[]>(
    [...day.day_exercises]
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => ({
        exerciseId: ex.exercise_id,
        exerciseName: ex.exercise?.name ?? '',
        exerciseType: ex.exercise?.default_type ?? 'reps',
        sets: ex.sets,
        targetReps: ex.target_reps,
        rir: ex.rir,
        restSeconds: ex.rest_seconds,
      })),
  )

  return (
    <div>
      <DayEditor userId={userId} exercises={exercises} onChange={setExercises} />
      <div className="sheet-actions">
        <button type="button" onClick={() => onSave(exercises)}>
          Guardar cambios
        </button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
