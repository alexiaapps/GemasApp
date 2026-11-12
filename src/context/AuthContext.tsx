import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isDemoEmail } from '../lib/demo'
import { startDemoSession } from '../lib/demoSession'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  /** Verdadero mientras se prepara la demo (login → reset de datos): la app sigue mostrando el login hasta que termine. */
  preparingDemo: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Entra a la cuenta demo. Devuelve el error (ya en español) si algo falla; en ese caso no queda sesión abierta. */
  enterDemo: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [preparingDemo, setPreparingDemo] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    // La cuenta demo es compartida: un cierre global revocaría la sesión de los demás visitantes.
    await supabase.auth.signOut({ scope: isDemoEmail(session?.user.email) ? 'local' : 'global' })
  }

  async function enterDemo() {
    setPreparingDemo(true)
    try {
      await startDemoSession()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'No se pudo iniciar la demo. Inténtalo de nuevo.' }
    } finally {
      setPreparingDemo(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, preparingDemo, signIn, signUp, signOut, enterDemo }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
