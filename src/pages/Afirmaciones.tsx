import { useEffect, useMemo, useRef, useState, type FormEvent, type TouchEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import AffirmationCard from '../components/AffirmationCard'
import { getSignedUrls } from '../lib/media'
import { listGoalOptions, type GoalOption } from '../lib/weeklyGoals'
import {
  generateAffirmationScript,
  listAllScriptsForUser,
  saveScript,
  type AffirmationScriptWithGoal,
  type GeneratedScript,
} from '../lib/scripts'

const SWIPE_THRESHOLD = 50

export default function Afirmaciones() {
  const { user } = useAuth()

  const [goalOptions, setGoalOptions] = useState<GoalOption[]>([])
  const [scripts, setScripts] = useState<AffirmationScriptWithGoal[]>([])
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<GeneratedScript | null>(null)
  const [saving, setSaving] = useState(false)

  const [activeIndex, setActiveIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

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

  useEffect(() => {
    const paths = scripts.filter((s) => s.audio_storage_path).map((s) => s.audio_storage_path as string)
    if (paths.length === 0) {
      setSignedUrls(new Map())
      return
    }
    let cancelled = false
    getSignedUrls(paths)
      .then((map) => {
        if (!cancelled) setSignedUrls(map)
      })
      .catch((e) => setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [scripts])

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

  function handleDeleted(scriptId: string) {
    setScripts((prev) => {
      const next = prev.filter((s) => s.id !== scriptId)
      setActiveIndex((i) => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
  }

  function handleAudioUpdated(scriptId: string, path: string, durationSec: number) {
    setScripts((prev) =>
      prev.map((s) =>
        s.id === scriptId ? { ...s, audio_storage_path: path, audio_duration_sec: durationSec } : s,
      ),
    )
  }

  function goPrev() {
    setActiveIndex((i) => (i - 1 + scripts.length) % scripts.length)
  }

  function goNext() {
    setActiveIndex((i) => (i + 1) % scripts.length)
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: TouchEvent) {
    if (touchStartX.current == null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (deltaX > SWIPE_THRESHOLD) goPrev()
    else if (deltaX < -SWIPE_THRESHOLD) goNext()
  }

  if (loading) {
    return (
      <div className="page">
        <h1>Afirmaciones</h1>
        <p>Cargando...</p>
      </div>
    )
  }

  const activeScript = scripts[activeIndex]

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
          <div
            className="playlist-carousel"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {scripts.length > 1 && (
              <button className="lightbox-nav lightbox-prev" onClick={goPrev} aria-label="Anterior">
                ‹
              </button>
            )}

            <AffirmationCard
              key={activeScript.id}
              userId={user.id}
              script={activeScript}
              audioUrl={activeScript.audio_storage_path ? signedUrls.get(activeScript.audio_storage_path) : undefined}
              onDeleted={handleDeleted}
              onAudioUpdated={handleAudioUpdated}
            />

            {scripts.length > 1 && (
              <button className="lightbox-nav lightbox-next" onClick={goNext} aria-label="Siguiente">
                ›
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
