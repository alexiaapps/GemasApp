import { useEffect, useRef, useMemo, useState, type FormEvent, type TouchEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import AffirmationCard from '../components/AffirmationCard'
import { getSignedUrls } from '../lib/media'
import { listGoalOptions, type GoalOption } from '../lib/weeklyGoals'
import {
  generateAffirmationScript,
  listAllScriptsForUser,
  saveScript,
  uploadScriptAudio,
  type AffirmationScriptWithGoal,
  type GeneratedScript,
} from '../lib/scripts'

const SWIPE_THRESHOLD = 50

export default function Afirmaciones() {
  const { user } = useAuth()

  const [goalOptions, setGoalOptions] = useState<GoalOption[]>([])
  const [scripts, setScripts] = useState<AffirmationScriptWithGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<GeneratedScript | null>(null)
  const [saving, setSaving] = useState(false)

  const [activeIndex, setActiveIndex] = useState(0)
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined)
  const touchStartX = useRef<number | null>(null)

  // --- Reproductor único para toda la pantalla ---
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playingScriptId, setPlayingScriptId] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [audioLoading, setAudioLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [goals, scriptList] = await Promise.all([
          listGoalOptions(user!.id),
          listAllScriptsForUser(user!.id),
        ])
        if (cancelled) return
        setGoalOptions(goals)
        setScripts(scriptList)
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
  }, [user])

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

  const selectedGoal = useMemo(
    () => goalOptions.find((g) => g.id === selectedGoalId) ?? null,
    [goalOptions, selectedGoalId],
  )

  async function runGenerate() {
    if (!selectedGoal) return
    setGenerating(true)
    setError(null)
    try {
      const result = await generateAffirmationScript(
        selectedGoal.text,
        selectedGoal.dimension?.label ?? selectedGoal.dimension_key,
        null,
      )
      setDraft(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  function handleGenerateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    runGenerate()
  }

  async function handleSaveDraft() {
    if (!user || !draft || !selectedGoal) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveScript(user.id, selectedGoal.id, draft.title, draft.script)
      setScripts((prev) => [{ ...saved, goal: selectedGoal }, ...prev])
      setDraft(null)
      setActiveIndex(0)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function handleCoverUploaded(scriptId: string, path: string) {
    setScripts((prev) => prev.map((s) => (s.id === scriptId ? { ...s, cover_image_path: path } : s)))
  }

  async function handleAudioRecorded(
    script: AffirmationScriptWithGoal,
    blob: Blob,
    durationSec: number,
    mimeType: string,
  ) {
    if (!user) return
    setError(null)
    try {
      const path = await uploadScriptAudio(user.id, script, blob, mimeType, durationSec)
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
      <div className="page">
        <h1>Afirmaciones</h1>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Afirmaciones</h1>
      {error && <p className="auth-error">{error}</p>}

      <section className="generate-panel">
        <h2>Generar nueva afirmación</h2>
        <form className="area-form" onSubmit={handleGenerateSubmit}>
          <label>
            Meta grande
            <select value={selectedGoalId} onChange={(e) => setSelectedGoalId(e.target.value)} required>
              <option value="" disabled>
                Selecciona una meta
              </option>
              {goalOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {(g.dimension?.emoji ?? '') + ' ' + g.text + ' · ' + (g.dimension?.label ?? g.dimension_key)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={generating || !selectedGoalId}>
            {generating ? 'Generando...' : '✨ Generar'}
          </button>
        </form>

        {draft && (
          <div className="script-draft">
            <h4>{draft.title}</h4>
            <p className="script-text">{draft.script}</p>
            <div className="script-draft-actions">
              <button type="button" onClick={handleSaveDraft} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" onClick={runGenerate} disabled={generating}>
                Generar otra versión
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="playlist-section">
        <h2>
          Tu playlist de afirmaciones {scripts.length > 0 && `· ${activeIndex + 1}/${scripts.length}`}
        </h2>

        {scripts.length === 0 && <p className="subgoal-empty">Todavía no tienes guiones guardados</p>}

        {activeScript && user && (
          <div className="playlist-carousel" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <AffirmationCard
              key={activeScript.id}
              userId={user.id}
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
      </section>

      <audio
        ref={audioRef}
        hidden
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
      />
    </div>
  )
}
