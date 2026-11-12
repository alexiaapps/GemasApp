import { useEffect, useState } from 'react'
import { isBundledCover, resolveCoverUrl } from './media'

/**
 * - none:    el guion no tiene portada
 * - loading: se está pidiendo la signed URL del Storage
 * - ready:   hay una URL para el <img>
 * - failed:  tiene portada pero no se pudo resolver (el <img> puede fallar después; eso lo maneja la tarjeta)
 */
export type CoverStatus = 'none' | 'loading' | 'ready' | 'failed'

/** Resuelve la portada de un guion con `resolveCoverUrl`: la misma lógica para toda la app. */
export function useCoverUrl(path: string | null | undefined): { url: string | undefined; status: CoverStatus } {
  // Las imágenes incluidas en la app no necesitan esperar a nadie: se resuelven al instante.
  const bundled = path && isBundledCover(path) ? path : undefined

  // El resultado se guarda junto a la ruta que lo originó: así "cargando" se deriva y no hay setState síncrono en el efecto.
  const [resolved, setResolved] = useState<{ path: string; url: string | undefined } | null>(null)

  useEffect(() => {
    if (!path || bundled) return
    let cancelled = false
    resolveCoverUrl(path)
      .then((url) => {
        if (!cancelled) setResolved({ path, url })
      })
      .catch((err) => {
        console.warn('No se pudo resolver la portada:', err)
        if (!cancelled) setResolved({ path, url: undefined })
      })
    return () => {
      cancelled = true
    }
  }, [path, bundled])

  if (!path) return { url: undefined, status: 'none' }
  if (bundled) return { url: bundled, status: 'ready' }
  if (resolved?.path !== path) return { url: undefined, status: 'loading' }
  return resolved.url ? { url: resolved.url, status: 'ready' } : { url: undefined, status: 'failed' }
}
