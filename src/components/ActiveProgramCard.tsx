import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listProgramsWithProgress, type ProgramWithProgress } from '../lib/programs'

/** Tarjeta de Inicio con el programa de entrenamiento activo y su progreso. */
export default function ActiveProgramCard() {
  const { user } = useAuth()
  const [program, setProgram] = useState<ProgramWithProgress | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listProgramsWithProgress(user.id)
      .then((list) => {
        if (!cancelled) setProgram(list.find((p) => p.status === 'active') ?? null)
      })
      .catch(() => {
        if (!cancelled) setProgram(null)
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!loaded) return null

  if (!program) {
    return (
      <section className="active-program-card">
        <h2>Programa activo</h2>
        <div className="program-card">
          <p className="program-card-goal">Todavía no tienes un programa activo.</p>
          <Link to="/entrenamiento" className="active-program-link">
            Crear un programa <ChevronRight size={16} strokeWidth={2} />
          </Link>
        </div>
      </section>
    )
  }

  const pct = program.totalDays > 0 ? Math.round((program.completedDays / program.totalDays) * 100) : 0

  return (
    <section className="active-program-card">
      <h2>Programa activo</h2>
      <div className="program-card">
        <Link to={`/entrenamiento/${program.id}`} className="program-card-link">
          <div className="program-card-header">
            <span className="program-card-name">{program.name}</span>
            <span className="program-card-badge">Activo</span>
          </div>
          {program.goal && <p className="program-card-goal">{program.goal}</p>}
          <div className="rest-timer-bar">
            <div className="rest-timer-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="program-card-progress">
            {program.completedDays}/{program.totalDays} días completados
          </p>
        </Link>
      </div>
    </section>
  )
}
