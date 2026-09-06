import { useEffect, useRef, useState, type TouchEvent } from 'react'

export interface LightboxPhoto {
  id: string
  url: string
  caption: string | null
}

interface Props {
  photos: LightboxPhoto[]
  startIndex: number
  onClose: () => void
}

const SWIPE_THRESHOLD = 50

export default function PhotoLightbox({ photos, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex)
  const touchStartX = useRef<number | null>(null)

  function goPrev() {
    setIndex((i) => (i - 1 + photos.length) % photos.length)
  }

  function goNext() {
    setIndex((i) => (i + 1) % photos.length)
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length, onClose])

  function handleTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: TouchEvent) {
    if (touchStartX.current == null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (deltaX > SWIPE_THRESHOLD) goPrev()
    else if (deltaX < -SWIPE_THRESHOLD) goNext()
  }

  const current = photos[index]
  if (!current) return null

  return (
    <div
      className="lightbox-overlay"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button className="lightbox-close" onClick={onClose} aria-label="Cerrar">
        ×
      </button>

      {photos.length > 1 && (
        <button
          className="lightbox-nav lightbox-prev"
          onClick={(e) => {
            e.stopPropagation()
            goPrev()
          }}
          aria-label="Anterior"
        >
          ‹
        </button>
      )}

      <img
        src={current.url}
        alt={current.caption ?? ''}
        className="lightbox-image"
        onClick={(e) => e.stopPropagation()}
      />

      {photos.length > 1 && (
        <button
          className="lightbox-nav lightbox-next"
          onClick={(e) => {
            e.stopPropagation()
            goNext()
          }}
          aria-label="Siguiente"
        >
          ›
        </button>
      )}

      {current.caption && (
        <p className="lightbox-caption" onClick={(e) => e.stopPropagation()}>
          {current.caption}
        </p>
      )}
    </div>
  )
}
