import { ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
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

  const totalDays = program.weeks_total * program.days_per_week
  const completedDays = days.filter((d) => d.completed).length
  const overallPct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0

  return (
    <div className="page">
      <Link to="/entrenamiento" className="area-back">
        <ArrowLeft size={16} strokeWidth={1.75} /> Entrenamiento
      </Link>

      <h1>{program.name}</h1>
      {program.goal && <p className="program-subtitle">{program.goal}</p>}
      {error && <p className="auth-error">{error}</p>}

      <div className="program-overall-progress">
        <div className="program-overall-progress-label">
          <span>Progreso</span>
          <span>{overallPct}%</span>
        </div>
        <div className="rest-timer-bar">
          <div className="rest-timer-fill" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      {program.status === 'active' && (
        <button type="button" className="area-new-goal-btn" onClick={handleAddExtraWeek} disabled={addingWeek}>
          {addingWeek ? 'Agregando...' : '+ Agregar semana extra'}
        </button>
      )}

      <h2>Semanas</h2>

      {weeks.map((week) => {
        const weekDays = days.filter((d) => d.week === week).sort((a, b) => a.day_number - b.day_number)
        const collapsed = collapsedWeeks.has(week)
        const weekCompletedCount = weekDays.filter((d) => d.completed).length
        const weekFullyDone = weekDays.length > 0 && weekCompletedCount === weekDays.length

        return (
          <div key={week} className="program-week">
            <button type="button" className="program-week-header" onClick={() => toggleWeek(week)}>
              <span className={`program-week-status${weekFullyDone ? ' done' : ''}`}>
                {weekFullyDone ? <Check size={16} strokeWidth={2.5} /> : week}
              </span>
              <span className="program-week-title">
                <span className="program-week-name">Semana {week}</span>
                <span className="program-week-count">
                  {weekCompletedCount}/{program.days_per_week} Sesiones
                </span>
              </span>
              <span className="program-week-chevron">
                {collapsed ? (
                  <ChevronRight size={20} strokeWidth={1.75} />
                ) : (
                  <ChevronDown size={20} strokeWidth={1.75} />
                )}
              </span>
            </button>

            {!collapsed && (
              <ul className="program-day-list">
                {weekDays.map((day) => (
                  <li key={day.id} className="program-day-row">
                    <Link to={`/entrenamiento/sesion/${day.id}`} className="program-day-row-link">
                      <span className="program-day-row-name">Día {day.day_number}</span>
                      {day.completed && (
                        <span className="program-day-row-status">
                          <CheckCircle2 size={14} strokeWidth={1.75} /> Completada
                        </span>
                      )}
                    </Link>
                    {!day.completed && (
                      <button
                        type="button"
                        className="program-day-row-edit"
                        onClick={() => setEditingDayId(day.id)}
                        aria-label="Editar ejercicios del día"
                        title="Editar ejercicios"
                      >
                        <Pencil size={15} strokeWidth={1.75} />
                      </button>
                    )}
                    <span className="program-day-row-chevron">
                      <ChevronRight size={18} strokeWidth={1.75} />
                    </span>
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
