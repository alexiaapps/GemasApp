import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Exercise } from '../lib/exercises'
import type { DayExercisePlan } from '../lib/programs'
import ExercisePicker from './ExercisePicker'

interface Props {
  userId: string
  exercises: DayExercisePlan[]
  onChange: (exercises: DayExercisePlan[]) => void
}

export default function DayEditor({ userId, exercises, onChange }: Props) {
  const [pending, setPending] = useState<Exercise | null>(null)
  const [sets, setSets] = useState('3')
  const [targetReps, setTargetReps] = useState('')
  const [rir, setRir] = useState('')
  const [restSeconds, setRestSeconds] = useState('90')

  function handleSelectExercise(exercise: Exercise) {
    setPending(exercise)
    setTargetReps(exercise.default_type === 'time' ? '30' : '8-10')
    setRir('')
  }

  function handleAddExercise() {
    if (!pending) return
    const plan: DayExercisePlan = {
      exerciseId: pending.id,
      exerciseName: pending.name,
      exerciseType: pending.default_type,
      sets: Number(sets) || 1,
      targetReps: targetReps.trim() || (pending.default_type === 'time' ? '30' : '8-10'),
      rir: pending.default_type === 'reps' && rir.trim() !== '' ? Number(rir) : null,
      restSeconds: restSeconds.trim() !== '' ? Number(restSeconds) : null,
    }
    onChange([...exercises, plan])
    setPending(null)
    setSets('3')
    setTargetReps('')
    setRir('')
    setRestSeconds('90')
  }

  function handleRemove(index: number) {
    onChange(exercises.filter((_, i) => i !== index))
  }

  return (
    <div className="day-editor">
      {exercises.length > 0 && (
        <ul className="day-editor-list">
          {exercises.map((ex, index) => (
            <li key={`${ex.exerciseId}-${index}`} className="day-editor-item">
              <span className="day-editor-item-text">
                {ex.exerciseName} · {ex.sets}×{ex.targetReps}
                {ex.rir != null ? ` · RIR ${ex.rir}` : ''}
                {ex.restSeconds != null ? ` · ${ex.restSeconds}s descanso` : ''}
              </span>
              <button
                type="button"
                className="day-editor-remove"
                onClick={() => handleRemove(index)}
                aria-label="Quitar ejercicio"
              >
                <Trash2 size={15} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {exercises.length === 0 && <p className="subgoal-empty">Sin ejercicios todavía</p>}

      <div className="day-editor-add">
        <ExercisePicker userId={userId} onSelect={handleSelectExercise} />

        {pending && (
          <div className="day-editor-pending">
            <p className="day-editor-pending-name">{pending.name}</p>
            <div className="day-editor-pending-fields">
              <label>
                Sets
                <input type="number" min={1} value={sets} onChange={(e) => setSets(e.target.value)} />
              </label>
              <label>
                {pending.default_type === 'time' ? 'Segundos' : 'Reps'}
                <input
                  type="text"
                  placeholder={pending.default_type === 'time' ? '30' : '8-10'}
                  value={targetReps}
                  onChange={(e) => setTargetReps(e.target.value)}
                />
              </label>
              {pending.default_type === 'reps' && (
                <label>
                  RIR
                  <input type="number" min={0} value={rir} onChange={(e) => setRir(e.target.value)} />
                </label>
              )}
              <label>
                Descanso (s)
                <input
                  type="number"
                  min={0}
                  value={restSeconds}
                  onChange={(e) => setRestSeconds(e.target.value)}
                />
              </label>
            </div>
            <div className="day-editor-pending-actions">
              <button type="button" onClick={handleAddExercise}>
                + Agregar al día
              </button>
              <button type="button" onClick={() => setPending(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
