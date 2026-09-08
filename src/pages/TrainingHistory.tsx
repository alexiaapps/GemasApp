import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listAllLogsForUser, type ExerciseLogWithExercise } from '../lib/exerciseLogs'

export default function TrainingHistory() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<ExerciseLogWithExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    listAllLogsForUser(user.id)
      .then(setLogs)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="page">
        <p>Cargando...</p>
      </div>
    )
  }

  const byDate = new Map<string, ExerciseLogWithExercise[]>()
  for (const log of logs) {
    const list = byDate.get(log.log_date) ?? []
    list.push(log)
    byDate.set(log.log_date, list)
  }

  return (
    <div className="page">
      <Link to="/entrenamiento" className="area-back">
        ← Entrenamiento
      </Link>

      <h1>Historial de entrenamiento</h1>
      {error && <p className="auth-error">{error}</p>}

      {logs.length === 0 && <p className="subgoal-empty">Todavía no tienes registros</p>}

      {[...byDate.entries()].map(([date, dayLogs]) => (
        <div key={date} className="history-date-group">
          <h2>{date}</h2>
          <ul className="history-log-list">
            {dayLogs.map((log) => (
              <li key={log.id} className="history-log-item">
                <span className="history-log-exercise">{log.exercise?.name ?? 'Ejercicio'}</span>
                <span className="history-log-details">
                  Set {log.set_number} ·{' '}
                  {log.exercise?.default_type === 'time'
                    ? `${log.duration_sec ?? '—'}s`
                    : `${log.reps ?? '—'} reps`}
                  {log.weight != null ? ` · ${log.weight}${log.weight_unit}` : ''}
                  {log.assistance != null ? ` · asistencia ${log.assistance}` : ''}
                  {log.rir != null ? ` · RIR ${log.rir}` : ''}
                </span>
                {log.notes && <span className="history-log-notes">"{log.notes}"</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
