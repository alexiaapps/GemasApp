import { Pause, Play, SkipForward } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Segundos restantes al iniciar, o null si no hay timer corriendo (muestra 00:00 estático). */
  seconds: number | null
  /** Cambia cada vez que se inicia un timer nuevo, para reiniciar la cuenta aunque la duración sea igual. */
  resetKey?: string
  onDone: () => void
}

function formatDigits(totalSeconds: number): string[] {
  const clamped = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`.split('')
}

export default function RestTimer({ seconds, resetKey, onDone }: Props) {
  const [remaining, setRemaining] = useState(seconds ?? 0)
  const [paused, setPaused] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    setRemaining(seconds ?? 0)
    setPaused(false)
    doneRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useEffect(() => {
    if (seconds == null || paused) return

    if (remaining <= 0) {
      if (!doneRef.current) {
        doneRef.current = true
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(200)
        }
        onDone()
      }
      return
    }

    const timeout = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, paused, seconds])

  function handleSkip() {
    if (!doneRef.current) {
      doneRef.current = true
      onDone()
    }
  }

  const active = seconds != null
  const digits = formatDigits(active ? remaining : 0)

  return (
    <div className="rest-timer-compact">
      <div className="rest-timer-digits">
        {digits.map((ch, i) => (
          <span key={i} className={`rest-timer-digit${ch === ':' ? ' colon' : ''}`}>
            {ch}
          </span>
        ))}
      </div>

      {active && (
        <div className="rest-timer-mini-actions">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Reanudar descanso' : 'Pausar descanso'}
          >
            {paused ? (
              <Play size={13} strokeWidth={2} fill="currentColor" />
            ) : (
              <Pause size={13} strokeWidth={2} fill="currentColor" />
            )}
          </button>
          <button type="button" onClick={handleSkip} aria-label="Saltar descanso">
            <SkipForward size={13} strokeWidth={2} fill="currentColor" />
          </button>
        </div>
      )}
    </div>
  )
}
