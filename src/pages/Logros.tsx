import { useEffect, useState } from 'react'
import BadgesWall from '../components/BadgesWall'
import GoalHistory from '../components/GoalHistory'
import GrowthWheel from '../components/GrowthWheel'
import { useAuth } from '../context/AuthContext'
import { listCompletedGoals, type CompletedGoal } from '../lib/logros'

export default function Logros() {
  const { user } = useAuth()
  const [goals, setGoals] = useState<CompletedGoal[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listCompletedGoals(user.id)
      .then((list) => {
        if (!cancelled) setGoals(list)
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div className="page logros-page">
      <div className="logros-header">
        <h1>Logros</h1>
        <p className="logros-header-subtitle">Tu crecimiento, tus badges y tu historia</p>
      </div>

      <GrowthWheel />

      {error && <p className="auth-error">{error}</p>}

      {goals === null && !error ? (
        <p className="logros-muted">Cargando...</p>
      ) : (
        goals && (
          <>
            <BadgesWall goals={goals} />
            <GoalHistory goals={goals} />
          </>
        )
      )}
    </div>
  )
}
