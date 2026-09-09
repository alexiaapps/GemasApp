import { ImagePlus, Video, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import PhotoLightbox from './PhotoLightbox'
import {
  addVideoLinkMedia,
  deleteMedia,
  ensureAffirmationArea,
  getSignedUrls,
  listMediaByArea,
  toYouTubeEmbedUrl,
  uploadPhotoMedia,
  type AffirmationArea,
  type AffirmationMedia,
} from '../lib/media'

interface Props {
  userId: string
  dimensionKey: string
}

export default function AreaResourcesSection({ userId, dimensionKey }: Props) {
  const [area, setArea] = useState<AffirmationArea | null>(null)
  const [media, setMedia] = useState<AffirmationMedia[]>([])
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showVideoForm, setShowVideoForm] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const areaRow = await ensureAffirmationArea(userId, dimensionKey)
        if (cancelled) return
        setArea(areaRow)
        const mediaList = await listMediaByArea(areaRow.id)
        if (!cancelled) setMedia(mediaList)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId, dimensionKey])

  useEffect(() => {
    const paths = media.filter((m) => m.storage_path).map((m) => m.storage_path as string)
    if (paths.length === 0) {
      setSignedUrls(new Map())
      return
    }
    let cancelled = false
    getSignedUrls(paths)
      .then((map) => {
        if (!cancelled) setSignedUrls(map)
      })
      .catch((e) => setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [media])

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !area) return
    setBusy(true)
    setError(null)
    try {
      const newMedia = await uploadPhotoMedia(userId, dimensionKey, area.id, file)
      setMedia((prev) => [...prev, newMedia])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddVideoLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!area) return
    const form = e.currentTarget
    const formData = new FormData(form)
    const url = String(formData.get('url') ?? '').trim()
    if (!url) return

    const embed = toYouTubeEmbedUrl(url)
    if (!embed) {
      setError('Ese link no parece un video de YouTube válido')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const newMedia = await addVideoLinkMedia(userId, area.id, url)
      setMedia((prev) => [...prev, newMedia])
      form.reset()
      setShowVideoForm(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(item: AffirmationMedia) {
    if (!window.confirm('¿Borrar este elemento?')) return
    setBusy(true)
    setError(null)
    try {
      await deleteMedia(item)
      setMedia((prev) => prev.filter((m) => m.id !== item.id))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const videoLinks = media.filter((m) => m.media_type === 'video_link')
  const photos = media.filter((m) => m.media_type === 'photo')
  const photoItems = useMemo(
    () =>
      photos
        .filter((m) => m.storage_path && signedUrls.get(m.storage_path))
        .map((m) => ({ id: m.id, url: signedUrls.get(m.storage_path as string) as string, caption: m.caption })),
    [photos, signedUrls],
  )

  function openLightboxFor(mediaId: string) {
    const idx = photoItems.findIndex((p) => p.id === mediaId)
    if (idx >= 0) setLightboxIndex(idx)
  }

  if (loading) {
    return (
      <section className="resources-section">
        <h2>Recursos</h2>
        <p>Cargando...</p>
      </section>
    )
  }

  return (
    <section className="resources-section">
      <h2>Recursos</h2>
      {error && <p className="auth-error">{error}</p>}

      <div className="resources-subsection">
        <div className="resources-subsection-header">
          <h3>Videos</h3>
          <button
            type="button"
            className="resources-add-btn"
            disabled={busy || !area}
            onClick={() => setShowVideoForm((v) => !v)}
          >
            <Video size={15} strokeWidth={1.75} />
            Agregar link
          </button>
        </div>

        {showVideoForm && (
          <form className="area-form" onSubmit={handleAddVideoLink}>
            <label>
              Link de YouTube
              <input name="url" type="url" placeholder="https://youtu.be/..." required />
            </label>
            <button type="submit">Agregar video</button>
          </form>
        )}

        {videoLinks.length === 0 ? (
          <p className="subgoal-empty">Sin videos todavía</p>
        ) : (
          <div className="resources-video-list">
            {videoLinks.map((item) => {
              const embedUrl = item.external_url ? toYouTubeEmbedUrl(item.external_url) : null
              if (!embedUrl) return null
              return (
                <div key={item.id} className="resources-video-item">
                  <button className="gallery-item-delete" onClick={() => handleDelete(item)} disabled={busy}>
                    <X size={14} strokeWidth={2} />
                  </button>
                  <iframe
                    className="resources-video-frame"
                    src={embedUrl}
                    title="Video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="resources-subsection">
        <div className="resources-subsection-header">
          <h3>Fotos</h3>
          <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={handlePhotoChange} />
          <button
            type="button"
            className="resources-add-btn"
            disabled={busy || !area}
            onClick={() => photoInputRef.current?.click()}
          >
            <ImagePlus size={15} strokeWidth={1.75} />
            Agregar foto
          </button>
        </div>

        {photos.length === 0 ? (
          <p className="subgoal-empty">Sin fotos todavía</p>
        ) : (
          <div className="resources-photo-carousel">
            {photos.map((item) => {
              const url = item.storage_path ? signedUrls.get(item.storage_path) : undefined
              if (!url) return null
              return (
                <div key={item.id} className="gallery-item">
                  <button className="gallery-item-delete" onClick={() => handleDelete(item)} disabled={busy}>
                    <X size={14} strokeWidth={2} />
                  </button>
                  <img
                    src={url}
                    alt={item.caption ?? ''}
                    className="gallery-item-photo"
                    onClick={() => openLightboxFor(item.id)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox photos={photoItems} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </section>
  )
}
