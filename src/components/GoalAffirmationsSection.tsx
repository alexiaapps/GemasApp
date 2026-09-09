import { Loader2, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getSignedUrls } from '../lib/media'
import { listScriptsForGoal, type AffirmationScriptWithGoal } from '../lib/scripts'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface Props {
  userId: string
  goalId: string
}

export default function GoalAffirmationsSection({ userId, goalId }: Props) {
  const [scripts, setScripts] = useState<AffirmationScriptWithGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [audioLoading, setAudioLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const list = await listScriptsForGoal(userId, goalId)
        if (!cancelled) setScripts(list)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId, goalId])

  async function handlePlayPause(script: AffirmationScriptWithGoal) {
    if (!script.audio_storage_path || !audioRef.current) return

    if (playingId === script.id) {
      if (isPaused) {
        audioRef.current.play()
        setIsPaused(false)
      } else {
        audioRef.current.pause()
        setIsPaused(true)
      }
      return
    }

    setError(null)
    setAudioLoading(true)
    try {
      const map = await getSignedUrls([script.audio_storage_path])
      const url = map.get(script.audio_storage_path)
      if (!url) throw new Error('No se pudo cargar el audio')
      audioRef.current.src = url
      setPlayingId(script.id)
      setCurrentTime(0)
      await audioRef.current.play()
      setIsPaused(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAudioLoading(false)
    }
  }

  function handleSeek(time: number) {
    if (audioRef.current) audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  if (loading || scripts.length === 0) return null

  return (
    <div className="goal-affirmations-section">
      <p className="goal-affirmations-label">🎧 Afirmaciones de esta meta</p>
      {error && <p className="auth-error">{error}</p>}

      <ul className="goal-affirmations-list">
        {scripts.map((script) => {
          const isCurrent = playingId === script.id
          return (
            <li key={script.id} className="goal-affirmation-item">
              <span className="goal-affirmation-title">{script.title}</span>

              {script.audio_storage_path && (
                <div className="goal-affirmation-player">
                  <button
                    type="button"
                    className="goal-affirmation-play-btn"
                    onClick={() => handlePlayPause(script)}
                    disabled={audioLoading && isCurrent}
                    aria-label={isCurrent && !isPaused ? 'Pausar' : 'Reproducir'}
                  >
                    {audioLoading && isCurrent ? (
                      <Loader2 size={14} strokeWidth={1.75} className="icon-spin" />
                    ) : isCurrent && !isPaused ? (
                      <Pause size={14} strokeWidth={1.75} fill="currentColor" />
                    ) : (
                      <Play size={14} strokeWidth={1.75} fill="currentColor" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={isCurrent && duration ? duration : 0}
                    value={isCurrent ? currentTime : 0}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    className="goal-affirmation-scrubber"
                  />
                  <span className="goal-affirmation-time">
                    {formatTime(isCurrent ? currentTime : 0)} / {formatTime(isCurrent ? duration : 0)}
                  </span>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <audio
        ref={audioRef}
        hidden
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          setIsPaused(true)
          setPlayingId(null)
        }}
      />
    </div>
  )
}
