import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import TabLayout from './components/TabLayout'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Entrenamiento from './pages/Entrenamiento'
import ProgramDetail from './pages/ProgramDetail'
import TrainingSession from './pages/TrainingSession'
import TrainingHistory from './pages/TrainingHistory'
import Logros from './pages/Logros'
import Areas from './pages/Areas'
import AreaDetail from './pages/AreaDetail'
import Afirmaciones from './pages/Afirmaciones'

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
        <Route path="/entrenamiento/historial" element={<TrainingHistory />} />
        <Route path="/entrenamiento/:programId" element={<ProgramDetail />} />
        <Route path="/entrenamiento/sesion/:dayId" element={<TrainingSession />} />
        <Route path="/logros" element={<Logros />} />
        <Route path="/areas" element={<Areas />} />
        <Route path="/areas/:key" element={<AreaDetail />} />
        <Route path="/afirmaciones" element={<Afirmaciones />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
