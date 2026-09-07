import { useState } from 'react'
import { guessAudioMimeType } from '../lib/media'
import { deleteScript, uploadScriptAudio, type AffirmationScriptWithGoal } from '../lib/scripts'
import TeleprompterRecorder from './TeleprompterRecorder'

const CARD_GRADIENT =
  'linear-gradient(135deg, #FFC2E2 0%, #FFD9A8 28%, #FFF3A6 45%, #B8ECC0 62%, #A0E8DC 78%, #A8D4F5 100%)'

interface Props {
  userId: string
  script: AffirmationScriptWithGoal
  audioUrl?: string
  onDeleted: (scriptId: string) => void
  onAudioUpdated: (scriptId: string, path: string, durationSec: number) => void
}

export default function AffirmationCard({ userId, script, audioUrl, onDeleted, onAudioUpdated }: Props) {
  const [showTeleprompter, setShowTeleprompter] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRecorded(blob: Blob, durationSec: number, mimeType: string) {
    setShowTeleprompter(false)
    setBusy(true)
    setError(null)
    try {
      const path = await uploadScriptAudio(userId, script, blob, mimeType, durationSec)
      onAudioUpdated(script.id, path, durationSec)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Seguro que quieres borrar este guion de afirmación?')) return
    setBusy(true)
    setError(null)
    try {
      await deleteScript(script)
      onDeleted(script.id)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="affirmation-card" style={{ background: CARD_GRADIENT }}>
      <button
        className="affirmation-card-delete"
        onClick={handleDelete}
        disabled={busy}
        title="Borrar guion"
        aria-label="Borrar guion"
      >
        🗑
      </button>

      <h2 className="affirmation-card-title">{script.title}</h2>

      <div className="affirmation-card-scene">
        <p>{script.script_text}</p>
      </div>

      <p className="affirmation-card-legend">
        {script.goal?.dimension?.emoji} {script.goal?.dimension?.label} · {script.goal?.text}
      </p>

      {error && <p className="auth-error">{error}</p>}

      <div className="affirmation-card-actions">
        {script.audio_storage_path && audioUrl ? (
          <>
            <audio controls className="affirmation-card-audio">
              <source src={audioUrl} type={guessAudioMimeType(script.audio_storage_path)} />
            </audio>
            <button type="button" onClick={() => setShowTeleprompter(true)} disabled={busy}>
              Regrabar
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setShowTeleprompter(true)} disabled={busy}>
            {busy ? 'Guardando...' : '🎙️ Grabar mi voz'}
          </button>
        )}
      </div>

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
