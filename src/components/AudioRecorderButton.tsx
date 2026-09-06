import { useEffect, useRef, useState } from 'react'

const MAX_SECONDS = 30

// Orden de preferencia: mp4/aac es lo único que Safari (Mac/iPhone) reproduce nativamente.
const MIME_TYPE_PREFERENCE = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined
  }
  return MIME_TYPE_PREFERENCE.find((type) => MediaRecorder.isTypeSupported(type))
}

interface Props {
  onRecorded: (blob: Blob, durationSec: number, mimeType: string) => void
  disabled?: boolean
}

export default function AudioRecorderButton({ onRecorded, disabled }: Props) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)
  const stopTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cleanup() {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    if (stopTimeoutRef.current) window.clearTimeout(stopTimeoutRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
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
        // recorder.mimeType refleja lo que el navegador realmente usó (puede diferir de lo pedido).
        const actualMimeType = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: actualMimeType })
        cleanup()
        setRecording(false)
        setElapsed(0)
        if (durationSec > 0) onRecorded(blob, durationSec, actualMimeType)
      }

      recorder.start()
      setRecording(true)

      const startedAt = Date.now()
      intervalRef.current = window.setInterval(() => {
        setElapsed(Math.round((Date.now() - startedAt) / 1000))
      }, 250)

      stopTimeoutRef.current = window.setTimeout(() => {
        stopRecording()
      }, MAX_SECONDS * 1000)
    } catch {
      setError('No se pudo acceder al micrófono')
    }
  }

  const elapsedRef = useRef(0)
  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  if (recording) {
    return (
      <div className="audio-recorder-active">
        <span>🔴 Grabando... {elapsed}s / {MAX_SECONDS}s</span>
        <button type="button" onClick={stopRecording}>
          Detener
        </button>
      </div>
    )
  }

  return (
    <div>
      <button type="button" onClick={startRecording} disabled={disabled}>
        + Nota de voz
      </button>
      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}
