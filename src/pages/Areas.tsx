import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDimensions, type Dimension } from '../lib/areas'

export default function Areas() {
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    listDimensions()
      .then((data) => {
        if (!cancelled) setDimensions(data)
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
  }, [])

  if (loading) {
    return (
      <div className="page">
        <h1>Áreas</h1>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Áreas</h1>
      {error && <p className="auth-error">{error}</p>}

      <div className="areas-grid">
        {dimensions.map((dim) => (
          <Link
            key={dim.key}
            to={`/areas/${dim.key}`}
            className="area-card"
            style={{ borderColor: dim.color_hex, ['--area-color' as string]: dim.color_hex }}
          >
            <span className="area-emoji">{dim.emoji}</span>
            <span className="area-label">{dim.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
