import { useEffect, useRef, useState } from 'react'
import { findOrCreateExercise, searchExercises, type Exercise, type ExerciseType } from '../lib/exercises'

interface Props {
  userId: string
  onSelect: (exercise: Exercise) => void
}

export default function ExercisePicker({ userId, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Exercise[]>([])
  const [open, setOpen] = useState(false)
  const [newType, setNewType] = useState<ExerciseType>('reps')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timeout = setTimeout(() => {
      searchExercises(userId, query)
        .then((list) => {
          if (!cancelled) setResults(list)
        })
        .catch((e) => setError((e as Error).message))
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query, userId, open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const trimmed = query.trim()
  const exactMatch = results.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())

  async function handleCreate() {
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const exercise = await findOrCreateExercise(userId, trimmed, newType)
      onSelect(exercise)
      setQuery('')
      setResults([])
      setOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function handlePick(exercise: Exercise) {
    onSelect(exercise)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="exercise-picker" ref={containerRef}>
      <input
        type="text"
        placeholder="Buscar o crear ejercicio..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />

      {open && (
        <div className="exercise-picker-dropdown">
          {results.map((ex) => (
            <button
              type="button"
              key={ex.id}
              className="exercise-picker-option"
              onClick={() => handlePick(ex)}
            >
              {ex.name} <span className="exercise-picker-type">{ex.default_type === 'reps' ? 'reps' : 'tiempo'}</span>
            </button>
          ))}

          {trimmed && !exactMatch && (
            <div className="exercise-picker-create">
              <span>Crear "{trimmed}" como:</span>
              <div className="exercise-picker-create-row">
                <label>
                  <input
                    type="radio"
                    name="new-exercise-type"
                    checked={newType === 'reps'}
                    onChange={() => setNewType('reps')}
                  />
                  Reps
                </label>
                <label>
                  <input
                    type="radio"
                    name="new-exercise-type"
                    checked={newType === 'time'}
                    onChange={() => setNewType('time')}
                  />
                  Tiempo
                </label>
                <button type="button" onClick={handleCreate} disabled={busy}>
                  {busy ? 'Creando...' : '+ Crear'}
                </button>
              </div>
            </div>
          )}

          {!trimmed && results.length === 0 && (
            <p className="exercise-picker-empty">Escribe para buscar en tu catálogo</p>
          )}
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}
