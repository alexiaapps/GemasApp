import { useState } from 'react'
import type { DayExercisePlan, DayPlan } from '../lib/programs'
import DayEditor from './DayEditor'

interface Props {
  userId: string
  daysPerWeek: number
  onConfirm: (weekPlan: DayPlan[]) => void
  onCancel: () => void
  busy?: boolean
}

export default function WeekDesigner({ userId, daysPerWeek, onConfirm, onCancel, busy }: Props) {
  const [labels, setLabels] = useState<string[]>(
    Array.from({ length: daysPerWeek }, (_, i) => `Día ${i + 1}`),
  )
  const [exercisesByDay, setExercisesByDay] = useState<DayExercisePlan[][]>(
    Array.from({ length: daysPerWeek }, () => []),
  )
  const [activeDay, setActiveDay] = useState(0)

  function updateLabel(index: number, value: string) {
    setLabels((prev) => prev.map((l, i) => (i === index ? value : l)))
  }

  function updateExercises(index: number, exercises: DayExercisePlan[]) {
    setExercisesByDay((prev) => prev.map((e, i) => (i === index ? exercises : e)))
  }

  function handleConfirm() {
    const weekPlan: DayPlan[] = labels.map((label, i) => ({
      dayNumber: i + 1,
      label: label.trim() || `Día ${i + 1}`,
      exercises: exercisesByDay[i],
    }))
    onConfirm(weekPlan)
  }

  return (
    <div className="week-designer">
      <h2>Diseña tu semana</h2>
      <p className="auth-subtitle">
        Esta semana se repetirá para todas las semanas del programa.
      </p>

      <div className="week-designer-tabs">
        {labels.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`week-designer-tab${activeDay === i ? ' active' : ''}`}
            onClick={() => setActiveDay(i)}
          >
            Día {i + 1}
          </button>
        ))}
      </div>

      <label className="week-designer-label-input">
        Nombre del día
        <input
          type="text"
          value={labels[activeDay]}
          onChange={(e) => updateLabel(activeDay, e.target.value)}
        />
      </label>

      <DayEditor
        userId={userId}
        exercises={exercisesByDay[activeDay]}
        onChange={(exs) => updateExercises(activeDay, exs)}
      />

      <div className="week-designer-actions">
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" onClick={handleConfirm} disabled={busy}>
          {busy ? 'Creando...' : 'Crear Programa'}
        </button>
      </div>
    </div>
  )
}
