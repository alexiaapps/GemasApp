import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import TabLayout from './components/TabLayout'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Entrenamiento from './pages/Entrenamiento'
import Bitacora from './pages/Bitacora'
import Logros from './pages/Logros'
import Areas from './pages/Areas'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="app-loading">Cargando...</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/entrenamiento" element={<Entrenamiento />} />
        <Route path="/bitacora" element={<Bitacora />} />
        <Route path="/logros" element={<Logros />} />
        <Route path="/areas" element={<Areas />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
