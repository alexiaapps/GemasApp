import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { isDemoAvailable } from '../lib/demoSession'

export default function Login() {
  const { signIn, signUp, enterDemo, preparingDemo } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // El botón "Probar demo" solo aparece si el servidor confirma que la demo está disponible (DEMO_PASSWORD configurada).
  const [demoAvailable, setDemoAvailable] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    isDemoAvailable(controller.signal).then((available) => {
      if (!controller.signal.aborted) setDemoAvailable(available)
    })
    return () => controller.abort()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)

    if (result.error) {
      setError(result.error)
    } else if (mode === 'signup') {
      setInfo('Cuenta creada. Revisa tu correo para confirmar el registro.')
    }
    setSubmitting(false)
  }

  async function handleDemo() {
    setError(null)
    setInfo(null)
    const result = await enterDemo()
    if (result.error) setError(result.error)
  }

  return (
    <div className="auth-screen">
      <form className="auth-form" onSubmit={handleSubmit}>
        <img src="/logo-brand.png" alt="" className="auth-logo" />
        <h1 className="brand-wordmark">Gemas</h1>
        <p className="auth-subtitle">
          {mode === 'signin' ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
        </p>

        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-info">{info}</p>}

        <button type="submit" disabled={submitting || preparingDemo}>
          {submitting ? 'Procesando...' : mode === 'signin' ? 'Entrar' : 'Registrarme'}
        </button>

        {demoAvailable && (
          <div className="auth-demo">
            <button type="button" className="auth-demo-btn" onClick={handleDemo} disabled={submitting || preparingDemo}>
              {preparingDemo ? 'Preparando la demo...' : 'Probar demo'}
            </button>
            <p className="auth-demo-hint">Explora la app con datos de ejemplo, sin registrarte.</p>
          </div>
        )}

        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setInfo(null)
          }}
        >
          {mode === 'signin' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </div>
  )
}
