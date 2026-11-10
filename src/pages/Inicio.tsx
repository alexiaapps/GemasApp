import WeeklyGoalsSection from '../components/WeeklyGoalsSection'
import DailyLogSection from '../components/DailyLogSection'

export default function Inicio() {
  return (
    <div className="page inicio-page">
      <div className="inicio-header">
        <h1>Inicio</h1>
      </div>

      <WeeklyGoalsSection />

      <p>Aquí irá la tarjeta del programa activo.</p>

      <DailyLogSection />
    </div>
  )
}
