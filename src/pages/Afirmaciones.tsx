import { Loader2, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import AffirmationPlaylist from '../components/AffirmationPlaylist'
import { listGoalOptions, type GoalOption } from '../lib/weeklyGoals'
import { generateAffirmationScript, saveScript, type GeneratedScript } from '../lib/scripts'

export default function Afirmaciones() {
  const { user } = useAuth()

  const [goalOptions, setGoalOptions] = useState<GoalOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<GeneratedScript | null>(null)
  const [saving, setSaving] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const goals = await listGoalOptions(user!.id)
        if (!cancelled) setGoalOptions(goals)
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
      await saveScript(user.id, selectedGoal.id, draft.title, draft.script)
      setDraft(null)
      setRefreshToken((t) => t + 1)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page afirmaciones-page">
        <h1>Afirmaciones</h1>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page afirmaciones-page">
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
            {generating ? (
              <>
                <Loader2 size={16} strokeWidth={1.75} className="icon-spin" />
                Generando...
              </>
            ) : (
              <>
                <Wand2 size={16} strokeWidth={1.75} />
                Generar
              </>
            )}
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

      {user && <AffirmationPlaylist userId={user.id} refreshToken={refreshToken} />}
    </div>
  )
}
