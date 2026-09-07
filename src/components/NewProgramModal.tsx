import type { FormEvent } from 'react'
import { todayISO } from '../lib/date'
import type { NewProgramInput } from '../lib/programs'

interface Props {
  onConfirm: (input: NewProgramInput) => void
  onCancel: () => void
}

export default function NewProgramModal({ onConfirm, onCancel }: Props) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    onConfirm({
      name: String(formData.get('name') ?? '').trim(),
      goal: String(formData.get('goal') ?? '').trim(),
      weeksTotal: Math.max(1, Number(formData.get('weeks_total') ?? 4)),
      daysPerWeek: Math.max(1, Number(formData.get('days_per_week') ?? 3)),
      startDate: String(formData.get('start_date') ?? todayISO()),
    })
  }

  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
        <h3>Nuevo programa</h3>
        <form className="area-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input name="name" type="text" required />
          </label>
          <label>
            Meta
            <input name="goal" type="text" placeholder="Ej. Ganar fuerza" />
          </label>
          <label>
            Semanas totales
            <input name="weeks_total" type="number" min={1} defaultValue={4} required />
          </label>
          <label>
            Días por semana
            <input name="days_per_week" type="number" min={1} max={7} defaultValue={3} required />
          </label>
          <label>
            Fecha de inicio
            <input name="start_date" type="date" defaultValue={todayISO()} required />
          </label>
          <div className="sheet-actions">
            <button type="submit">Siguiente: diseñar semana</button>
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
