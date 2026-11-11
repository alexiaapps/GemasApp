import { BookOpen, Loader2, Mic, MoreHorizontal, Pause, Play, SkipBack, SkipForward, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { deleteScript, uploadScriptCover, type AffirmationScriptWithGoal } from '../lib/scripts'
import TeleprompterRecorder from './TeleprompterRecorder'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface Props {
  userId: string
  script: AffirmationScriptWithGoal
  coverUrl?: string
  isPlaying: boolean
  isCurrent: boolean
  currentTime: number
  duration: number
  audioLoading: boolean
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onSeek: (time: number) => void
  onCoverUploaded: (scriptId: string, path: string) => void
  onAudioRecorded: (blob: Blob, durationSec: number, mimeType: string) => void
  onDeleted: (scriptId: string) => void
}

export default function AffirmationCard({
  userId,
  script,
  coverUrl,
  isPlaying,
  isCurrent,
  currentTime,
  duration,
  audioLoading,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onCoverUploaded,
  onAudioRecorded,
  onDeleted,
}: Props) {
  const [coverBusy, setCoverBusy] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showTeleprompter, setShowTeleprompter] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const coverInputRef = useRef<HTMLInputElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  async function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCoverBusy(true)
    setError(null)
    try {
      const path = await uploadScriptCover(userId, script, file)
      onCoverUploaded(script.id, path)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCoverBusy(false)
    }
  }

  function closeReader() {
    setShowMenu(false)
    setConfirmingDelete(false)
  }

  // Escape cierra primero la confirmación de borrado y luego el lector; el foco empieza en la ✕
  useEffect(() => {
    if (!showMenu) return
    closeBtnRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (confirmingDelete) setConfirmingDelete(false)
      else closeReader()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showMenu, confirmingDelete])

  async function handleDelete() {
    setError(null)
    try {
      await deleteScript(script)
      onDeleted(script.id)
    } catch (err) {
      setError((err as Error).message)
      setConfirmingDelete(false)
    }
  }

  function handleRecorded(blob: Blob, durationSec: number, mimeType: string) {
    setShowTeleprompter(false)
    onAudioRecorded(blob, durationSec, mimeType)
  }

  return (
    <div className="affirmation-card">
      <button
        className="affirmation-menu-btn"
        onClick={() => setShowMenu(true)}
        aria-label="Más opciones"
      >
        <MoreHorizontal size={16} strokeWidth={1.75} />
      </button>

      <h2 className="affirmation-card-title">{script.title}</h2>

      <div className="affirmation-card-cover">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="affirmation-cover-img" />
        ) : (
          <div className="affirmation-cover-placeholder">Sin portada</div>
        )}
      </div>

      <div className="affirmation-card-actions-row">
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleCoverChange}
        />
        <button
          type="button"
          className="affirmation-cover-btn"
          onClick={() => coverInputRef.current?.click()}
          disabled={coverBusy}
        >
          {coverBusy ? 'Subiendo...' : coverUrl ? 'Cambiar portada' : '+ Subir portada'}
        </button>
        <button type="button" className="affirmation-read-btn" onClick={() => setShowMenu(true)}>
          <BookOpen size={16} strokeWidth={1.75} />
          Leer guion
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {script.audio_storage_path ? (
        <div className="affirmation-player">
          <input
            type="range"
            min={0}
            max={isCurrent && duration ? duration : 0}
            value={isCurrent ? currentTime : 0}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="affirmation-scrubber"
          />
          <div className="affirmation-scrubber-times">
            {formatTime(isCurrent ? currentTime : 0)} / {formatTime(isCurrent ? duration : 0)}
          </div>
          <div className="affirmation-player-controls">
            <button type="button" onClick={onPrev} aria-label="Anterior">
              <SkipBack size={18} strokeWidth={1.75} fill="currentColor" />
            </button>
            <button
              type="button"
              className="affirmation-play-btn"
              onClick={onPlayPause}
              disabled={audioLoading && isCurrent}
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {audioLoading && isCurrent ? (
                <Loader2 size={18} strokeWidth={1.75} className="icon-spin" />
              ) : isPlaying ? (
                <Pause size={18} strokeWidth={1.75} fill="currentColor" />
              ) : (
                <Play size={18} strokeWidth={1.75} fill="currentColor" />
              )}
            </button>
            <button type="button" onClick={onNext} aria-label="Siguiente">
              <SkipForward size={18} strokeWidth={1.75} fill="currentColor" />
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="affirmation-record-btn" onClick={() => setShowTeleprompter(true)}>
          <Mic size={18} strokeWidth={1.75} />
          Grabar mi voz
        </button>
      )}

      {showMenu && (
        <div className="sheet-overlay script-reader-overlay" onClick={closeReader}>
          <div
            className="sheet-content script-reader"
            role="dialog"
            aria-modal="true"
            aria-label={`Guion: ${script.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="script-reader-head">
              <p className="sheet-legend">
                {script.goal?.dimension?.emoji} {script.goal?.dimension?.label} · {script.goal?.text}
              </p>
              <button
                ref={closeBtnRef}
                type="button"
                className="script-reader-close"
                onClick={closeReader}
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.25} />
              </button>
            </div>

            <div className="script-reader-body">
              <h3>{script.title}</h3>
              <p className="script-text">{script.script_text}</p>

              {error && <p className="auth-error">{error}</p>}

              <div className="sheet-actions">
                {script.audio_storage_path && (
                  <button
                    type="button"
                    onClick={() => {
                      closeReader()
                      setShowTeleprompter(true)
                    }}
                  >
                    Regrabar
                  </button>
                )}
                <button type="button" onClick={closeReader}>
                  Cerrar
                </button>
              </div>

              <div className="script-reader-danger">
                {confirmingDelete ? (
                  <div className="script-delete-confirm" role="alertdialog" aria-label="Confirmar borrado">
                    <p>¿Borrar esta afirmación? No se puede deshacer.</p>
                    <div className="script-delete-confirm-actions">
                      <button type="button" onClick={() => setConfirmingDelete(false)}>
                        Cancelar
                      </button>
                      <button type="button" className="script-delete-yes" onClick={handleDelete}>
                        Sí, borrar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="script-delete-btn" onClick={() => setConfirmingDelete(true)}>
                    <Trash2 size={15} strokeWidth={1.75} />
                    Borrar afirmación
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showTeleprompter && (
        <TeleprompterRecorder
          scriptText={script.script_text}
          onCancel={() => setShowTeleprompter(false)}
          onRecorded={handleRecorded}
        />
      )}
    </div>
  )
}
