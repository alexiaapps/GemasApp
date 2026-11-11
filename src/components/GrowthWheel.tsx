import { useEffect, useState } from 'react'
import { pastelOf } from '../lib/color'
import { GEMS_PERIODS, getGemsByDimension, type DimensionGems, type GemsPeriod } from '../lib/logros'

/* Geometría de la rueda (unidades del viewBox). Cada gajo mide 30° y va del hueco central hacia afuera. */
const SIZE = 440
const C = SIZE / 2
const HOLE = 64 // radio del hueco donde va el total
const MIN_H = 16 // altura mínima: un gajo en 0 sigue viéndose como un gajo vacío
const MAX_H = 112 // altura del gajo con más gemas
const GUIDE_R = HOLE + MAX_H
const EMOJI_R = GUIDE_R + 24
const STEP = 360 / 12

function polar(radius: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) }
}

/** Gajo anular entre HOLE y `outer`, de `startDeg` a `startDeg + STEP` (0° = derecha, sentido horario). */
function wedgePath(outer: number, startDeg: number) {
  const endDeg = startDeg + STEP
  const a = polar(HOLE, startDeg)
  const b = polar(outer, startDeg)
  const c = polar(outer, endDeg)
  const d = polar(HOLE, endDeg)
  return `M ${a.x} ${a.y} L ${b.x} ${b.y} A ${outer} ${outer} 0 0 1 ${c.x} ${c.y} L ${d.x} ${d.y} A ${HOLE} ${HOLE} 0 0 0 ${a.x} ${a.y} Z`
}

function gemsLabel(n: number) {
  return `${n.toLocaleString('es-MX')} ${n === 1 ? 'gema' : 'gemas'}`
}

export default function GrowthWheel() {
  const [period, setPeriod] = useState<GemsPeriod>('week')
  // Resultado y error se guardan junto al periodo que los generó: así "cargando" se deriva
  // (periodo elegido sin resultado todavía) y se conservan los datos anteriores mientras llegan los nuevos.
  const [result, setResult] = useState<{ period: GemsPeriod; rows: DimensionGems[] } | null>(null)
  const [failure, setFailure] = useState<{ period: GemsPeriod; message: string } | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getGemsByDimension(period)
      .then((data) => {
        if (cancelled) return
        setResult({ period, rows: data })
        setFailure(null)
      })
      .catch((e) => {
        if (!cancelled) setFailure({ period, message: (e as Error).message })
      })
    return () => {
      cancelled = true
    }
  }, [period])

  const rows = result?.rows ?? null
  const error = failure?.period === period ? failure.message : null
  const loading = !error && result?.period !== period

  const data = rows ?? []
  const total = data.reduce((sum, r) => sum + r.total, 0)
  const max = data.reduce((m, r) => Math.max(m, r.total), 0)
  const selected = data.find((r) => r.dimension_key === selectedKey) ?? null
  const periodLabel = GEMS_PERIODS.find((p) => p.value === period)?.label ?? ''

  return (
    <section className="logros-section" aria-labelledby="rueda-title">
      <h2 id="rueda-title" className="logros-section-title">
        Rueda de crecimiento
      </h2>

      <div className="wheel-card">
        <div className="period-selector" role="group" aria-label="Periodo">
          {GEMS_PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`period-btn${period === p.value ? ' active' : ''}`}
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && <p className="auth-error">{error}</p>}

        {rows && (
          <div className={`wheel-box${loading ? ' loading' : ''}`}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="wheel-svg" role="group" aria-label="Gemas por área">
              <circle cx={C} cy={C} r={GUIDE_R} className="wheel-guide" />

              {data.map((row, i) => {
                const startDeg = -90 + i * STEP
                const height = max > 0 ? MIN_H + (MAX_H - MIN_H) * (row.total / max) : MIN_H
                const empty = row.total === 0
                const isSelected = row.dimension_key === selectedKey
                const emojiPos = polar(EMOJI_R, startDeg + STEP / 2)
                const toggle = () => setSelectedKey(isSelected ? null : row.dimension_key)

                return (
                  <g
                    key={row.dimension_key}
                    className={`wheel-wedge${empty ? ' empty' : ''}${isSelected ? ' selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`${row.label}: ${gemsLabel(row.total)}`}
                    onClick={toggle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggle()
                      }
                    }}
                  >
                    <path
                      d={wedgePath(HOLE + height, startDeg)}
                      style={{
                        fill: empty ? `color-mix(in srgb, ${row.color_hex} 14%, white)` : row.color_hex,
                      }}
                    />
                    <text x={emojiPos.x} y={emojiPos.y} className="wheel-emoji" textAnchor="middle" dominantBaseline="central">
                      {row.emoji}
                    </text>
                  </g>
                )
              })}

              <text x={C} y={C - 6} className="wheel-total" textAnchor="middle" dominantBaseline="central">
                {total.toLocaleString('es-MX')}
              </text>
              <text x={C} y={C + 22} className="wheel-total-label" textAnchor="middle">
                {total === 1 ? 'gema' : 'gemas'}
              </text>
            </svg>
          </div>
        )}

        {!rows && loading && <p className="logros-muted">Cargando...</p>}

        {rows && (
          <div className="wheel-detail" aria-live="polite">
            {selected ? (
              <>
                <span
                  className="wheel-detail-emoji"
                  style={{ background: selected.color_hex, color: '#111111' }}
                  aria-hidden="true"
                >
                  {selected.emoji}
                </span>
                <span className="wheel-detail-text">
                  <strong>{selected.label}</strong>
                  <span>
                    {gemsLabel(selected.total)} · {periodLabel.toLowerCase()}
                  </span>
                </span>
              </>
            ) : total === 0 ? (
              <span className="logros-muted">
                Aún no hay gemas {period === 'total' ? 'en tu rueda' : `${periodLabel.toLowerCase()}`}. Completa metas y
                submetas para empezar a llenarla.
              </span>
            ) : (
              <span className="logros-muted">Toca un gajo para ver las gemas de esa área.</span>
            )}
          </div>
        )}

        {rows && (
          <ul className="wheel-legend" aria-label={`Gemas por área · ${periodLabel.toLowerCase()}`}>
            {data.map((row) => {
              const isSelected = row.dimension_key === selectedKey
              return (
                <li key={row.dimension_key}>
                  <button
                    type="button"
                    className={`legend-item${row.total === 0 ? ' empty' : ''}${isSelected ? ' selected' : ''}`}
                    style={{ background: pastelOf(row.color_hex, row.total === 0 ? 10 : 28) }}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedKey(isSelected ? null : row.dimension_key)}
                  >
                    <span className="legend-emoji" aria-hidden="true">
                      {row.emoji}
                    </span>
                    <span className="legend-text">
                      <span className="legend-name">{row.label}</span>
                      <span className="legend-gems">{gemsLabel(row.total)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
