import { achievedAt, formatAchievedDate, type CompletedGoal } from '../lib/logros'
import { pastelOf } from '../lib/color'

/** Muro de insignias: una por cada meta grande completada. */
export default function BadgesWall({ goals }: { goals: CompletedGoal[] }) {
  return (
    <section className="logros-section" aria-labelledby="badges-title">
      <h2 id="badges-title" className="logros-section-title">
        Badges
        {goals.length > 0 && <span className="logros-count">{goals.length}</span>}
      </h2>

      {goals.length === 0 ? (
        <p className="logros-empty">Aún no tienes badges. Completa tu primera meta grande para ganar el primero.</p>
      ) : (
        <ul className="badge-grid">
          {goals.map((goal) => {
            const color = goal.dimension?.color_hex ?? '#6ee7b7'
            const date = formatAchievedDate(achievedAt(goal))
            return (
              <li key={goal.id} className="badge-card" style={{ background: pastelOf(color) }}>
                <span className="badge-emblem" style={{ background: color }} aria-hidden="true">
                  {goal.icon_emoji || goal.dimension?.emoji}
                </span>
                <span className="badge-title">{goal.text}</span>
                {date && <span className="badge-date">{date}</span>}
                <span className="badge-gems">+{goal.gems_reward} gemas</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
