import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { Goal } from '../lib/areas'
import {
  deleteScript,
  generateAffirmationScript,
  listScriptsByGoal,
  saveScript,
  type AffirmationScript,
  type GeneratedScript,
} from '../lib/scripts'

interface Props {
  goal: Goal
  dimensionLabel: string
}

export default function AffirmationScriptSection({ goal, dimensionLabel }: Props) {
  const { user } = useAuth()

  const [scripts, setScripts] = useState<AffirmationScript[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<GeneratedScript | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    listScriptsByGoal(goal.id)
      .then((list) => {
        if (!cancelled) setScripts(list)
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [goal.id])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const result = await generateAffirmationScript(goal.text, dimensionLabel, goal.category)
      setDraft(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!user || !draft) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveScript(user.id, goal.id, draft.title, draft.script)
      setScripts((prev) => [saved, ...prev])
      setDraft(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteScript(script: AffirmationScript) {
    if (!window.confirm('¿Seguro que quieres borrar este guion?')) return
    setError(null)
    try {
      await deleteScript(script.id)
      setScripts((prev) => prev.filter((s) => s.id !== script.id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="script-section">
      <button type="button" className="area-new-goal-btn" onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generando...' : '✨ Generar guion de afirmación'}
      </button>

      {error && <p className="auth-error">{error}</p>}

      {draft && (
        <div className="script-draft">
          <h4>{draft.title}</h4>
          <p className="script-text">{draft.script}</p>
          <div className="script-draft-actions">
            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generando...' : 'Generar otra versión'}
            </button>
          </div>
        </div>
      )}

      {!loading && scripts.length > 0 && (
        <ul className="script-list">
          {scripts.map((s) => (
            <li key={s.id} className="script-item">
              <div className="script-item-header">
                <h4>{s.title}</h4>
                <button
                  className="subgoal-delete-btn"
                  onClick={() => handleDeleteScript(s)}
                  title="Borrar guion"
                  aria-label="Borrar guion"
                >
                  🗑
                </button>
              </div>
              <p className="script-text">{s.script_text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
