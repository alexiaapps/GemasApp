import { useEffect, useRef, useState, type TouchEvent } from 'react'
import AffirmationCard from './AffirmationCard'
import { getSignedUrls } from '../lib/media'
import {
  listAllScriptsForUser,
  listScriptsForDimension,
  uploadScriptAudio,
  type AffirmationScriptWithGoal,
} from '../lib/scripts'

const SWIPE_THRESHOLD = 50

interface Props {
  userId: string
  /** Si se da, solo muestra guiones cuya meta grande pertenezca a esta área. Si se omite, muestra todos. */
  dimensionKey?: string
  /** Cambia este valor para forzar un refetch (ej. después de guardar un guion nuevo desde otra sección). */
  refreshToken?: number
  title?: string
  emptyMessage?: string
}

export default function AffirmationPlaylist({
  userId,
  dimensionKey,
  refreshToken,
  title = 'Tu playlist de afirmaciones',
  emptyMessage = 'Todavía no tienes guiones guardados',
}: Props) {
  const [scripts, setScripts] = useState<AffirmationScriptWithGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeIndex, setActiveIndex] = useState(0)
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined)
  const touchStartX = useRef<number | null>(null)

  // --- Reproductor único para este carrusel ---
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playingScriptId, setPlayingScriptId] = useState<string | null>(null)
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
        const list = dimensionKey
          ? await listScriptsForDimension(userId, dimensionKey)
          : await listAllScriptsForUser(userId)
        if (cancelled) return
        setScripts(list)
        setActiveIndex(0)
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
  }, [userId, dimensionKey, refreshToken])

  const activeScript = scripts[activeIndex] as AffirmationScriptWithGoal | undefined

  // Portada de la tarjeta visible: se pide fresca cada vez que cambia.
  useEffect(() => {
    const path = activeScript?.cover_image_path
    if (!path) {
      setCoverUrl(undefined)
      return
    }
    let cancelled = false
    getSignedUrls([path])
      .then((map) => {
        if (!cancelled) setCoverUrl(map.get(path))
      })
      .catch((e) => setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [activeScript?.cover_image_path])

  function handleCoverUploaded(scriptId: string, path: string) {
    setScripts((prev) => prev.map((s) => (s.id === scriptId ? { ...s, cover_image_path: path } : s)))
  }

  async function handleAudioRecorded(
    script: AffirmationScriptWithGoal,
    blob: Blob,
    durationSec: number,
    mimeType: string,
  ) {
    setError(null)
    try {
      const path = await uploadScriptAudio(userId, script, blob, mimeType, durationSec)
      setScripts((prev) =>
        prev.map((s) =>
          s.id === script.id ? { ...s, audio_storage_path: path, audio_duration_sec: durationSec } : s,
        ),
      )
      if (playingScriptId === script.id) {
        audioRef.current?.pause()
        setPlayingScriptId(null)
        setIsPaused(true)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  function handleDeleted(scriptId: string) {
    if (playingScriptId === scriptId) {
      audioRef.current?.pause()
      setPlayingScriptId(null)
      setIsPaused(true)
    }
    setScripts((prev) => {
      const next = prev.filter((s) => s.id !== scriptId)
      setActiveIndex((i) => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
  }

  function findNextPlayableFrom(index: number): number | null {
    for (let i = index + 1; i < scripts.length; i++) {
      if (scripts[i].audio_storage_path) return i
    }
    return null
  }

  function findPrevPlayableFrom(index: number): number | null {
    for (let i = index - 1; i >= 0; i--) {
      if (scripts[i].audio_storage_path) return i
    }
    return null
  }

  async function playScriptAt(index: number) {
    const script = scripts[index]
    if (!script?.audio_storage_path || !audioRef.current) return
    setError(null)
    setAudioLoading(true)
    try {
      const map = await getSignedUrls([script.audio_storage_path])
      const url = map.get(script.audio_storage_path)
      if (!url) throw new Error('No se pudo cargar el audio')
      audioRef.current.src = url
      setActiveIndex(index)
      setPlayingScriptId(script.id)
      setCurrentTime(0)
      await audioRef.current.play()
      setIsPaused(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAudioLoading(false)
    }
  }

  function handlePlayPause() {
    if (!audioRef.current || !activeScript) return
    if (playingScriptId === activeScript.id) {
      if (isPaused) {
        audioRef.current.play()
        setIsPaused(false)
      } else {
        audioRef.current.pause()
        setIsPaused(true)
      }
    } else {
      playScriptAt(activeIndex)
    }
  }

  function handlePrevPlay() {
    const idx = findPrevPlayableFrom(activeIndex)
    if (idx != null) playScriptAt(idx)
  }

  function handleNextPlay() {
    const idx = findNextPlayableFrom(activeIndex)
    if (idx != null) playScriptAt(idx)
  }

  function handleEnded() {
    setIsPaused(true)
    const finishedIndex = scripts.findIndex((s) => s.id === playingScriptId)
    const idx = finishedIndex >= 0 ? findNextPlayableFrom(finishedIndex) : null
    if (idx != null) {
      playScriptAt(idx)
    } else {
      setPlayingScriptId(null)
    }
  }

  function handleSeek(time: number) {
    if (audioRef.current) audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  function goPrevCard() {
    setActiveIndex((i) => (i - 1 + scripts.length) % scripts.length)
  }

  function goNextCard() {
    setActiveIndex((i) => (i + 1) % scripts.length)
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: TouchEvent) {
    if (touchStartX.current == null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (deltaX > SWIPE_THRESHOLD) goPrevCard()
    else if (deltaX < -SWIPE_THRESHOLD) goNextCard()
  }

  if (loading) {
    return (
      <section className="playlist-section">
        <h2>{title}</h2>
        <p>Cargando...</p>
      </section>
    )
  }

  return (
    <section className="playlist-section">
      <h2>
        {title} {scripts.length > 0 && `· ${activeIndex + 1}/${scripts.length}`}
      </h2>

      {error && <p className="auth-error">{error}</p>}

      {scripts.length === 0 && <p className="subgoal-empty">{emptyMessage}</p>}

      {activeScript && (
        <div className="playlist-carousel" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <AffirmationCard
            key={activeScript.id}
            userId={userId}
            script={activeScript}
            coverUrl={coverUrl}
            isPlaying={playingScriptId === activeScript.id && !isPaused}
            isCurrent={playingScriptId === activeScript.id}
            currentTime={currentTime}
            duration={duration}
            audioLoading={audioLoading}
            onPlayPause={handlePlayPause}
            onPrev={handlePrevPlay}
            onNext={handleNextPlay}
            onSeek={handleSeek}
            onCoverUploaded={handleCoverUploaded}
            onAudioRecorded={(blob, durationSec, mimeType) =>
              handleAudioRecorded(activeScript, blob, durationSec, mimeType)
            }
            onDeleted={handleDeleted}
          />
        </div>
      )}

      <audio
        ref={audioRef}
        hidden
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
      />
    </section>
  )
}
