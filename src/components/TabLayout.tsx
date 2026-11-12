import { Dumbbell, Home, LayoutGrid, Sparkles, Trophy } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoEmail } from '../lib/demo'

const TABS = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/entrenamiento', label: 'Entrenamiento', icon: Dumbbell },
  { to: '/logros', label: 'Logros', icon: Trophy },
  { to: '/areas', label: 'Áreas', icon: LayoutGrid },
  { to: '/afirmaciones', label: 'Afirmaciones', icon: Sparkles },
]

export default function TabLayout() {
  const { signOut, user } = useAuth()

  return (
    <div className="app-shell">
      <div className="app-top">
        {isDemoEmail(user?.email) && (
          <div className="demo-banner" role="status">
            Modo demo: los cambios se reinician en cada entrada.
          </div>
        )}
        <header className="app-header">
          <div className="app-brand">
            <img src="/logo-brand.png" alt="" className="app-logo" />
            <span className="app-title brand-wordmark">Gemas</span>
          </div>
          <button className="signout-btn" onClick={signOut}>
            Salir
          </button>
        </header>
      </div>

      <main className="app-content">
        <Outlet />
      </main>

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
          >
            <span className="tab-icon">
              <tab.icon size={22} strokeWidth={1.75} />
            </span>
            <span className="tab-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
