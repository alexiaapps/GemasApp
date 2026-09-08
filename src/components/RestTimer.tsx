import { useEffect, useRef, useState } from 'react'

interface Props {
  seconds: number
  onDone: () => void
}

export default function RestTimer({ seconds, onDone }: Props) {
  const [remaining, setRemaining] = useState(seconds)
  const [paused, setPaused] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    if (paused) return

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
  }, [remaining, paused])

  const pct = seconds > 0 ? Math.min(100, ((seconds - remaining) / seconds) * 100) : 100

  return (
    <div className="rest-timer">
      <div className="rest-timer-info">
        <span>Descanso</span>
        <span>{remaining}s</span>
      </div>
      <div className="rest-timer-bar">
        <div className="rest-timer-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="rest-timer-actions">
        <button type="button" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Reanudar' : 'Pausar'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!doneRef.current) {
              doneRef.current = true
              onDone()
            }
          }}
        >
          Saltar
        </button>
      </div>
    </div>
  )
}
