import WeeklyGoalsSection from '../components/WeeklyGoalsSection'
import DailyLogSection from '../components/DailyLogSection'

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatToday(): string {
  const d = new Date()
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export default function Inicio() {
  return (
    <div className="page inicio-page">
      <div className="inicio-header">
        <h1>Hoy</h1>
        <p className="inicio-header-subtitle">Progreso semanal y diario</p>
        <p className="inicio-header-date">{formatToday()}</p>
      </div>

      <WeeklyGoalsSection />

      <p>Aquí irá la tarjeta del programa activo.</p>

      <DailyLogSection />
    </div>
  )
}
