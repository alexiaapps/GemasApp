import { useEffect, useRef, useState } from 'react'
import { pickSupportedMimeType } from '../lib/audio'

const WORDS_PER_MINUTE = 140
const MIN_DURATION_SEC = 60

interface Props {
  scriptText: string
  onCancel: () => void
  onRecorded: (blob: Blob, durationSec: number, mimeType: string) => void
}

export default function TeleprompterRecorder({ scriptText, onCancel, onRecorded }: Props) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const elapsedRef = useRef(0)

  const wordCount = scriptText.trim().split(/\s+/).filter(Boolean).length
  const targetDurationSec = Math.max(MIN_DURATION_SEC, (wordCount / WORDS_PER_MINUTE) * 60)

  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  useEffect(() => {
    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }

  function scrollStep() {
    const el = scrollRef.current
    if (!el) return
    const elapsedSec = (Date.now() - startTimeRef.current) / 1000
    const progress = Math.min(1, elapsedSec / targetDurationSec)
    const maxScroll = el.scrollHeight - el.clientHeight
    el.scrollTop = progress * maxScroll
    setElapsed(Math.round(elapsedSec))
    if (progress < 1) {
      rafRef.current = requestAnimationFrame(scrollStep)
    }
  }

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = pickSupportedMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const durationSec = elapsedRef.current
        const actualMimeType = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: actualMimeType })
        cleanup()
        setRecording(false)
        if (durationSec > 0) onRecorded(blob, durationSec, actualMimeType)
      }

      recorder.start()
      setRecording(true)
      startTimeRef.current = Date.now()
      if (scrollRef.current) scrollRef.current.scrollTop = 0
      rafRef.current = requestAnimationFrame(scrollStep)
    } catch {
      setError('No se pudo acceder al micrófono')
    }
  }

  function stopRecording() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    mediaRecorderRef.current?.stop()
  }

  function handleCancel() {
    cleanup()
    onCancel()
  }

  return (
    <div className="teleprompter-overlay">
      <button className="lightbox-close" onClick={handleCancel} aria-label="Cerrar">
        ×
      </button>

      <div className="teleprompter-scroll" ref={scrollRef}>
        <p className="teleprompter-text">{scriptText}</p>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="teleprompter-controls">
        {!recording ? (
          <button type="button" onClick={startRecording}>
            🎙️ Empezar a grabar
          </button>
        ) : (
          <>
            <span>🔴 Grabando... {elapsed}s</span>
            <button type="button" onClick={stopRecording}>
              Detener y guardar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
