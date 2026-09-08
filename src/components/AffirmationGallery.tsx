import { ImagePlus, Video, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import AudioRecorderButton from './AudioRecorderButton'
import PhotoLightbox from './PhotoLightbox'
import {
  addVideoLinkMedia,
  deleteMedia,
  ensureAffirmationArea,
  getSignedUrls,
  guessAudioMimeType,
  listMediaByArea,
  toYouTubeEmbedUrl,
  uploadAudioMedia,
  uploadCoverImage,
  uploadPhotoMedia,
  type AffirmationArea,
  type AffirmationMedia,
} from '../lib/media'

interface Props {
  userId: string
  dimensionKey: string
}

export default function AffirmationGallery({ userId, dimensionKey }: Props) {
  const [area, setArea] = useState<AffirmationArea | null>(null)
  const [media, setMedia] = useState<AffirmationMedia[]>([])
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showVideoForm, setShowVideoForm] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const coverInputRef = useRef<HTMLInputElement>(null)
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
        if (cancelled) return
        setMedia(mediaList)
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
    const paths = [
      ...(area?.cover_image_path ? [area.cover_image_path] : []),
      ...media.filter((m) => m.storage_path).map((m) => m.storage_path as string),
    ]
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
  }, [area?.cover_image_path, media])

  async function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const path = await uploadCoverImage(userId, dimensionKey, file)
      setArea((prev) => (prev ? { ...prev, cover_image_path: path } : prev))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

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

  async function handleAudioRecorded(blob: Blob, durationSec: number, mimeType: string) {
    if (!area) return
    setBusy(true)
    setError(null)
    try {
      const newMedia = await uploadAudioMedia(userId, dimensionKey, area.id, blob, durationSec, mimeType)
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
    if (!window.confirm('¿Borrar este elemento de la galería?')) return
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

  const photoItems = useMemo(
    () =>
      media
        .filter((m) => m.media_type === 'photo' && m.storage_path && signedUrls.get(m.storage_path))
        .map((m) => ({ id: m.id, url: signedUrls.get(m.storage_path as string) as string, caption: m.caption })),
    [media, signedUrls],
  )

  function openLightboxFor(mediaId: string) {
    const idx = photoItems.findIndex((p) => p.id === mediaId)
    if (idx >= 0) setLightboxIndex(idx)
  }

  if (loading) {
    return (
      <div className="gallery-section">
        <h2>Afirmaciones</h2>
        <p>Cargando galería...</p>
      </div>
    )
  }

  const coverUrl = area?.cover_image_path ? signedUrls.get(area.cover_image_path) : null

  return (
    <div className="gallery-section">
      <h2>Afirmaciones</h2>
      {error && <p className="auth-error">{error}</p>}

      <div className="gallery-cover">
        {coverUrl ? (
          <img src={coverUrl} alt="Portada" className="gallery-cover-img" />
        ) : (
          <div className="gallery-cover-placeholder">Sin portada</div>
        )}
        <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverChange} />
        <button type="button" disabled={busy} onClick={() => coverInputRef.current?.click()}>
          <ImagePlus size={16} strokeWidth={1.75} />
          {coverUrl ? 'Cambiar portada' : 'Subir portada'}
        </button>
      </div>

      <div className="gallery-actions">
        <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={handlePhotoChange} />
        <button type="button" disabled={busy || !area} onClick={() => photoInputRef.current?.click()}>
          <ImagePlus size={16} strokeWidth={1.75} />
          Foto
        </button>
        <AudioRecorderButton onRecorded={handleAudioRecorded} disabled={busy || !area} />
        <button type="button" disabled={busy || !area} onClick={() => setShowVideoForm((v) => !v)}>
          <Video size={16} strokeWidth={1.75} />
          Video (link)
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

      <div className="gallery-carousel">
        {media.length === 0 && <p className="subgoal-empty">Sin elementos todavía</p>}
        {media.map((item) => {
          const url = item.storage_path ? signedUrls.get(item.storage_path) : undefined
          const embedUrl = item.media_type === 'video_link' && item.external_url
            ? toYouTubeEmbedUrl(item.external_url)
            : null

          return (
            <div key={item.id} className="gallery-item">
              <button className="gallery-item-delete" onClick={() => handleDelete(item)} disabled={busy}>
                <X size={14} strokeWidth={2} />
              </button>

              {item.media_type === 'photo' && url && (
                <img
                  src={url}
                  alt={item.caption ?? ''}
                  className="gallery-item-photo"
                  onClick={() => openLightboxFor(item.id)}
                />
              )}

              {item.media_type === 'audio' && url && (
                <audio controls className="gallery-item-audio">
                  <source src={url} type={guessAudioMimeType(item.storage_path ?? '')} />
                </audio>
              )}

              {item.media_type === 'video_link' && embedUrl && (
                <iframe
                  className="gallery-item-video"
                  src={embedUrl}
                  title="Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          )
        })}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photoItems}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
