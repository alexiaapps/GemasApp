// Orden de preferencia: mp4/aac es lo único que Safari (Mac/iPhone) reproduce nativamente.
const MIME_TYPE_PREFERENCE = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']

export function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined
  }
  return MIME_TYPE_PREFERENCE.find((type) => MediaRecorder.isTypeSupported(type))
}

/** Extensión de archivo según el mime type real que grabó MediaRecorder. */
export function audioExtensionFor(mimeType: string): string {
  return mimeType.startsWith('audio/mp4') ? 'm4a' : 'webm'
}

/** Mime type aproximado a partir de la extensión guardada, para reproducir con el <source type> correcto. */
export function guessAudioMimeType(path: string): string {
  return path.endsWith('.m4a') ? 'audio/mp4' : 'audio/webm'
}
