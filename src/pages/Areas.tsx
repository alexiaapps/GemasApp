import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDimensions, type Dimension } from '../lib/areas'
import { getContrastTextColor } from '../lib/color'

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

  return (
    <div className="page areas-page">
      <div className="areas-header">
        <h1>Mis áreas</h1>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="auth-error">{error}</p>}

      <div className="areas-grid">
        {dimensions.map((dim) => (
          <Link
            key={dim.key}
            to={`/areas/${dim.key}`}
            className="area-card"
            style={{ background: dim.color_hex, color: getContrastTextColor(dim.color_hex) }}
          >
            <span className="area-emoji">{dim.emoji}</span>
            <span className="area-label">{dim.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
