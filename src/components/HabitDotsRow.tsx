import { mondayOfWeek, toISODate, todayISO } from '../lib/date'

const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface Props {
  checkinDates: Set<string>
  dimensionColor: string
  onToggleToday: () => void
  toggling?: boolean
}

export default function HabitDotsRow({ checkinDates, dimensionColor, onToggleToday, toggling }: Props) {
  const today = todayISO()
  const monday = mondayOfWeek(new Date(`${today}T00:00:00`))
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return toISODate(d)
  })

  return (
    <div className="habit-dots-row">
      {days.map((iso, i) => {
        const checked = checkinDates.has(iso)
        const isToday = iso === today
        const style = checked ? { background: dimensionColor, borderColor: dimensionColor } : undefined

        if (isToday) {
          return (
            <button
              key={iso}
              type="button"
              className={`habit-dot habit-dot-today${checked ? ' checked' : ''}`}
              style={style}
              onClick={onToggleToday}
              disabled={toggling}
              aria-label={checked ? 'Quitar check-in de hoy' : 'Marcar check-in de hoy'}
            >
              {WEEKDAY_INITIALS[i]}
            </button>
          )
        }

        return (
          <span key={iso} className={`habit-dot${checked ? ' checked' : ''}`} style={style}>
            {WEEKDAY_INITIALS[i]}
          </span>
        )
      })}
    </div>
  )
}
