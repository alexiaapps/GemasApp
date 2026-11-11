import { Check, ChevronDown, Repeat } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listSubgoalsByGoal, type Subgoal } from '../lib/areas'
import { pastelOf } from '../lib/color'
import { achievedAt, formatAchievedDate, type CompletedGoal } from '../lib/logros'

/** Línea de tiempo de metas completadas; cada una se expande para mostrar las submetas que la lograron. */
export default function GoalHistory({ goals }: { goals: CompletedGoal[] }) {
  return (
    <section className="logros-section" aria-labelledby="historial-title">
      <h2 id="historial-title" className="logros-section-title">
        Historial
      </h2>

      {goals.length === 0 ? (
        <p className="logros-empty">
          Tu historial está en blanco por ahora. Cada meta grande que completes aparecerá aquí, con las submetas que te
          llevaron a lograrla.
        </p>
      ) : (
        <ol className="timeline">
          {goals.map((goal) => (
            <TimelineItem key={goal.id} goal={goal} />
          ))}
        </ol>
      )}
    </section>
  )
}

function TimelineItem({ goal }: { goal: CompletedGoal }) {
  const [open, setOpen] = useState(false)
  const [subgoals, setSubgoals] = useState<Subgoal[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const color = goal.dimension?.color_hex ?? '#6ee7b7'
  const date = formatAchievedDate(achievedAt(goal))
  const panelId = `timeline-panel-${goal.id}`

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next || subgoals || loading) return
    setLoading(true)
    setError(null)
    try {
      const all = await listSubgoalsByGoal(goal.id)
      // Solo las completadas, en el orden en que se lograron (las sin fecha, al final)
      const done = all.filter((s) => s.completed)
      done.sort((a, b) => (a.completed_at ?? '9999').localeCompare(b.completed_at ?? '9999'))
      setSubgoals(done)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <li className="timeline-item">
      <span className="timeline-dot" style={{ background: color }} aria-hidden="true" />

      <div className={`timeline-card${open ? ' open' : ''}`} style={{ ['--area-color' as string]: color }}>
        <button type="button" className="timeline-head" onClick={toggle} aria-expanded={open} aria-controls={panelId}>
          <span className="timeline-emoji" style={{ background: pastelOf(color) }} aria-hidden="true">
            {goal.icon_emoji || goal.dimension?.emoji}
          </span>
          <span className="timeline-main">
            <span className="timeline-title">{goal.text}</span>
            <span className="timeline-meta">
              {goal.dimension?.label}
              {date && ` · ${date}`}
            </span>
          </span>
          <ChevronDown size={20} strokeWidth={2.25} className="timeline-chevron" aria-hidden="true" />
        </button>

        {open && (
          <div id={panelId} className="timeline-panel">
            {loading && <p className="logros-muted">Cargando...</p>}
            {error && <p className="auth-error">{error}</p>}

            {subgoals && subgoals.length === 0 && (
              <p className="logros-muted">Esta meta no tiene submetas completadas registradas.</p>
            )}

            {subgoals && subgoals.length > 0 && (
              <ul className="timeline-subgoals">
                {subgoals.map((s) => (
                  <li key={s.id} className="timeline-subgoal">
                    <span className="timeline-subgoal-check" style={{ background: pastelOf(color) }} aria-hidden="true">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span className="timeline-subgoal-main">
                      <span className="timeline-subgoal-text">{s.text}</span>
                      <span className="timeline-subgoal-meta">
                        {formatAchievedDate(s.completed_at) ?? 'Sin fecha'}
                      </span>
                    </span>
                    <span className={`timeline-kind${s.goal_kind === 'habit' ? ' habit' : ''}`}>
                      {s.goal_kind === 'habit' ? (
                        <>
                          <Repeat size={12} strokeWidth={2.25} /> Hábito
                        </>
                      ) : (
                        'Acción única'
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Link to={`/areas/${goal.dimension_key}/${goal.id}`} className="timeline-link">
              Ver meta
            </Link>
          </div>
        )}
      </div>
    </li>
  )
}
