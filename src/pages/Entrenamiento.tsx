import { MoreHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NewProgramModal from '../components/NewProgramModal'
import WeekDesigner from '../components/WeekDesigner'
import {
  createProgram,
  deleteProgram,
  listProgramsWithProgress,
  updateProgram,
  type DayPlan,
  type NewProgramInput,
  type ProgramWithProgress,
} from '../lib/programs'

type FlowStep = 'list' | 'new-program' | 'design-week'

export default function Entrenamiento() {
  const { user } = useAuth()

  const [programs, setPrograms] = useState<ProgramWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [step, setStep] = useState<FlowStep>('list')
  const [newProgramInput, setNewProgramInput] = useState<NewProgramInput | null>(null)
  const [creating, setCreating] = useState(false)

  const [editingProgramId, setEditingProgramId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    refreshPrograms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function refreshPrograms() {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const list = await listProgramsWithProgress(user.id)
      setPrograms(list)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleStep1Confirm(input: NewProgramInput) {
    setNewProgramInput(input)
    setStep('design-week')
  }

  async function handleCreateProgram(weekPlan: DayPlan[]) {
    if (!user || !newProgramInput) return
    setCreating(true)
    setError(null)
    try {
      await createProgram(user.id, newProgramInput, weekPlan)
      setStep('list')
      setNewProgramInput(null)
      await refreshPrograms()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(program: ProgramWithProgress) {
    const confirmed = window.confirm(
      `¿Seguro que quieres borrar "${program.name}"? Se borrarán todas sus semanas y ejercicios asignados. Esto no se puede deshacer.`,
    )
    if (!confirmed) return
    setError(null)
    try {
      await deleteProgram(program.id)
      setMenuOpenId(null)
      await refreshPrograms()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleSaveEdit(programId: string, name: string, goal: string) {
    setError(null)
    try {
      await updateProgram(programId, { name, goal })
      setEditingProgramId(null)
      await refreshPrograms()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (step === 'design-week' && newProgramInput) {
    return (
      <div className="page">
        <WeekDesigner
          userId={user!.id}
          daysPerWeek={newProgramInput.daysPerWeek}
          onConfirm={handleCreateProgram}
          onCancel={() => {
            setStep('list')
            setNewProgramInput(null)
          }}
          busy={creating}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page">
        <h1>Entrenamiento</h1>
        <p>Cargando...</p>
      </div>
    )
  }

  const activePrograms = programs.filter((p) => p.status === 'active')
  const archivedPrograms = programs.filter((p) => p.status === 'archived')

  return (
    <div className="page">
      <h1>Entrenamiento</h1>
      {error && <p className="auth-error">{error}</p>}

      <div className="entrenamiento-top-actions">
        <button type="button" className="area-new-goal-btn" onClick={() => setStep('new-program')}>
          + Nuevo programa
        </button>
        <Link to="/entrenamiento/historial" className="entrenamiento-history-link">
          Ver historial
        </Link>
      </div>

      {activePrograms.map((program) => (
        <ProgramCard
          key={program.id}
          program={program}
          isEditing={editingProgramId === program.id}
          isMenuOpen={menuOpenId === program.id}
          onToggleMenu={() => setMenuOpenId(menuOpenId === program.id ? null : program.id)}
          onEdit={() => {
            setEditingProgramId(program.id)
            setMenuOpenId(null)
          }}
          onCancelEdit={() => setEditingProgramId(null)}
          onSaveEdit={(name, goal) => handleSaveEdit(program.id, name, goal)}
          onDelete={() => handleDelete(program)}
        />
      ))}

      {archivedPrograms.length > 0 && (
        <>
          <h2>Archivados</h2>
          {archivedPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              isEditing={editingProgramId === program.id}
              isMenuOpen={menuOpenId === program.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === program.id ? null : program.id)}
              onEdit={() => {
                setEditingProgramId(program.id)
                setMenuOpenId(null)
              }}
              onCancelEdit={() => setEditingProgramId(null)}
              onSaveEdit={(name, goal) => handleSaveEdit(program.id, name, goal)}
              onDelete={() => handleDelete(program)}
            />
          ))}
        </>
      )}

      {programs.length === 0 && <p className="subgoal-empty">Todavía no tienes programas</p>}

      {step === 'new-program' && (
        <NewProgramModal onConfirm={handleStep1Confirm} onCancel={() => setStep('list')} />
      )}
    </div>
  )
}

function ProgramCard({
  program,
  isEditing,
  isMenuOpen,
  onToggleMenu,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  program: ProgramWithProgress
  isEditing: boolean
  isMenuOpen: boolean
  onToggleMenu: () => void
  onEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (name: string, goal: string) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(program.name)
  const [goal, setGoal] = useState(program.goal ?? '')

  useEffect(() => {
    if (isEditing) {
      setName(program.name)
      setGoal(program.goal ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  if (isEditing) {
    return (
      <div className="program-card">
        <div className="area-form">
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Meta
            <input value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
          <div className="sheet-actions">
            <button type="button" onClick={() => onSaveEdit(name, goal)}>
              Guardar
            </button>
            <button type="button" onClick={onCancelEdit}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="program-card">
      <Link to={`/entrenamiento/${program.id}`} className="program-card-link">
        <div className="program-card-header">
          <span className="program-card-name">{program.name}</span>
          {program.status === 'active' && <span className="program-card-badge">Activo</span>}
        </div>
        {program.goal && <p className="program-card-goal">{program.goal}</p>}
        <p className="program-card-progress">
          {program.completedDays}/{program.totalDays} días completados
        </p>
      </Link>

      <button type="button" className="program-card-menu-btn" onClick={onToggleMenu} aria-label="Más opciones">
        <MoreHorizontal size={18} strokeWidth={1.75} />
      </button>

      {isMenuOpen && (
        <div className="program-card-menu">
          <button type="button" onClick={onEdit}>
            Editar nombre/meta
          </button>
          <button type="button" className="sheet-danger" onClick={onDelete}>
            Borrar programa
          </button>
        </div>
      )}
    </div>
  )
}
