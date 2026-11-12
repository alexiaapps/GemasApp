import { audioExtensionFor, guessAudioMimeType } from './audio'
import { supabase } from './supabase'

export { guessAudioMimeType }

export interface AffirmationArea {
  id: string
  user_id: string
  dimension_key: string
  cover_image_path: string | null
  created_at: string
}

export type MediaType = 'photo' | 'audio' | 'video_link'

export interface AffirmationMedia {
  id: string
  user_id: string
  area_id: string
  media_type: MediaType
  storage_path: string | null
  external_url: string | null
  duration_sec: number | null
  caption: string | null
  created_at: string
}

export const BUCKET = 'affirmations'

/** Prefijo de las portadas incluidas en la app (public/demo/): se usan tal cual como URL pública, sin pasar por el Storage. */
export const BUNDLED_COVER_PREFIX = '/demo/'

export function isBundledCover(path: string | null | undefined): boolean {
  return typeof path === 'string' && path.startsWith(BUNDLED_COVER_PREFIX)
}
const SIGNED_URL_EXPIRES_IN = 60 * 60 // 1 hora

export async function getAffirmationArea(userId: string, dimensionKey: string) {
  const { data, error } = await supabase
    .from('affirmation_areas')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension_key', dimensionKey)
    .maybeSingle()

  if (error) throw error
  return data as AffirmationArea | null
}

/** El trigger de registro ya crea esta fila, pero por si acaso no existe, la crea aquí. */
export async function ensureAffirmationArea(userId: string, dimensionKey: string) {
  const existing = await getAffirmationArea(userId, dimensionKey)
  if (existing) return existing

  const { data, error } = await supabase
    .from('affirmation_areas')
    .insert({ user_id: userId, dimension_key: dimensionKey })
    .select()
    .single()

  if (error) throw error
  return data as AffirmationArea
}

export async function listMediaByArea(areaId: string) {
  const { data, error } = await supabase
    .from('affirmation_media')
    .select('*')
    .eq('area_id', areaId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as AffirmationMedia[]
}

export async function getSignedUrls(paths: string[]) {
  const map = new Map<string, string>()
  if (paths.length === 0) return map

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_EXPIRES_IN)

  if (error) throw error

  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl)
  }
  return map
}

/**
 * ÚNICA función que convierte un `cover_image_path` en una URL para el <img>:
 * - "/demo/..." (imagen incluida en la app) → se usa tal cual, sin tocar el Storage;
 * - cualquier otra ruta → signed URL del Storage.
 * Devuelve undefined si no hay portada o no se pudo resolver.
 */
export async function resolveCoverUrl(path: string | null | undefined): Promise<string | undefined> {
  if (!path) return undefined
  if (isBundledCover(path)) return path
  const map = await getSignedUrls([path])
  return map.get(path)
}

export async function uploadPhotoMedia(
  userId: string,
  dimensionKey: string,
  areaId: string,
  file: File,
) {
  const blob = await compressImage(file)
  const path = `${userId}/${dimensionKey}/${crypto.randomUUID()}.jpg`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg' })
  if (uploadError) throw uploadError

  const { data, error: dbError } = await supabase
    .from('affirmation_media')
    .insert({ user_id: userId, area_id: areaId, media_type: 'photo', storage_path: path })
    .select()
    .single()
  if (dbError) throw dbError

  return data as AffirmationMedia
}

export async function uploadAudioMedia(
  userId: string,
  dimensionKey: string,
  areaId: string,
  blob: Blob,
  durationSec: number,
  mimeType: string,
) {
  const path = `${userId}/${dimensionKey}/${crypto.randomUUID()}.${audioExtensionFor(mimeType)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mimeType })
  if (uploadError) throw uploadError

  const { data, error: dbError } = await supabase
    .from('affirmation_media')
    .insert({
      user_id: userId,
      area_id: areaId,
      media_type: 'audio',
      storage_path: path,
      duration_sec: durationSec,
    })
    .select()
    .single()
  if (dbError) throw dbError

  return data as AffirmationMedia
}

export async function addVideoLinkMedia(userId: string, areaId: string, externalUrl: string) {
  const { data, error } = await supabase
    .from('affirmation_media')
    .insert({ user_id: userId, area_id: areaId, media_type: 'video_link', external_url: externalUrl })
    .select()
    .single()
  if (error) throw error

  return data as AffirmationMedia
}

export async function deleteMedia(media: AffirmationMedia) {
  if (media.storage_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([media.storage_path])
    if (storageError) throw storageError
  }

  const { error: dbError } = await supabase.from('affirmation_media').delete().eq('id', media.id)
  if (dbError) throw dbError
}

// --- Compresión de imágenes en el navegador ---

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('No se pudo leer la imagen'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  const img = await loadImageElement(file)
  const scale = Math.min(1, maxWidth / img.width)
  const width = Math.round(img.width * scale)
  const height = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen'))),
      'image/jpeg',
      quality,
    )
  })
}

// --- YouTube ---

export function toYouTubeEmbedUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim())
    let videoId: string | null = null

    if (u.hostname.includes('youtu.be')) {
      videoId = u.pathname.slice(1)
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') {
        videoId = u.searchParams.get('v')
      } else if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.replace('/embed/', '')
      } else if (u.pathname.startsWith('/shorts/')) {
        videoId = u.pathname.replace('/shorts/', '')
      }
    }

    if (!videoId) return null
    videoId = videoId.split(/[?&]/)[0]
    return `https://www.youtube-nocookie.com/embed/${videoId}`
  } catch {
    return null
  }
}
