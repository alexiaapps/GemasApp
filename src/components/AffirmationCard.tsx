import { useRef, useState, type ChangeEvent } from 'react'
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
  const [error, setError] = useState<string | null>(null)

  const coverInputRef = useRef<HTMLInputElement>(null)

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

  async function handleDelete() {
    if (!window.confirm('¿Seguro que quieres borrar esta afirmación?')) return
    try {
      await deleteScript(script)
      onDeleted(script.id)
    } catch (err) {
      setError((err as Error).message)
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
        ⋯
      </button>

      <h2 className="affirmation-card-title">{script.title}</h2>

      <div className="affirmation-card-cover">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="affirmation-cover-img" />
        ) : (
          <div className="affirmation-cover-placeholder">Sin portada</div>
        )}
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
            <span>{formatTime(isCurrent ? currentTime : 0)}</span>
            <span>{formatTime(isCurrent ? duration : 0)}</span>
          </div>
          <div className="affirmation-player-controls">
            <button type="button" onClick={onPrev} aria-label="Anterior">
              ⏮
            </button>
            <button
              type="button"
              className="affirmation-play-btn"
              onClick={onPlayPause}
              disabled={audioLoading && isCurrent}
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {audioLoading && isCurrent ? '…' : isPlaying ? '⏸' : '▶'}
            </button>
            <button type="button" onClick={onNext} aria-label="Siguiente">
              ⏭
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="affirmation-record-btn" onClick={() => setShowTeleprompter(true)}>
          🎙️ Grabar mi voz
        </button>
      )}

      {showMenu && (
        <div className="sheet-overlay" onClick={() => setShowMenu(false)}>
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-legend">
              {script.goal?.dimension?.emoji} {script.goal?.dimension?.label} · {script.goal?.text}
            </p>
            <h3>{script.title}</h3>
            <p className="script-text">{script.script_text}</p>
            <div className="sheet-actions">
              {script.audio_storage_path && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    setShowTeleprompter(true)
                  }}
                >
                  Regrabar
                </button>
              )}
              <button type="button" className="sheet-danger" onClick={handleDelete}>
                Borrar afirmación
              </button>
              <button type="button" onClick={() => setShowMenu(false)}>
                Cerrar
              </button>
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
