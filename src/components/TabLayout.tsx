import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/entrenamiento', label: 'Entrenamiento', icon: '💪' },
  { to: '/logros', label: 'Logros', icon: '🏆' },
  { to: '/areas', label: 'Áreas', icon: '✨' },
  { to: '/afirmaciones', label: 'Afirmaciones', icon: '💬' },
]

export default function TabLayout() {
  const { signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">Gemas</span>
        <button className="signout-btn" onClick={signOut}>
          Salir
        </button>
      </header>

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
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
