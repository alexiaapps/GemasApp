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
  const pausedRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Un solo efecto por timer (arranca/reinicia con resetKey): el conteo vive en una
  // variable local, no en estado de React, para que "¿ya terminó?" nunca se decida
  // leyendo un `remaining` de un render viejo — eso era lo que cancelaba el timer
  // siguiente apenas arrancaba (ver commit que corrige este bug).
  useEffect(() => {
    doneRef.current = false
    setPaused(false)
    pausedRef.current = false

    if (seconds == null) {
      setRemaining(0)
      return
    }

    let current = seconds
    setRemaining(current)

    const interval = setInterval(() => {
      if (pausedRef.current) return
      current -= 1
      setRemaining(Math.max(0, current))
      if (current <= 0 && !doneRef.current) {
        doneRef.current = true
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(200)
        }
        onDoneRef.current()
      }
    }, 1000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  function togglePause() {
    setPaused((p) => {
      pausedRef.current = !p
      return !p
    })
  }

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
            onClick={togglePause}
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
