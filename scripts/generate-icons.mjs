import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const publicDir = path.join(rootDir, 'public')
const source = path.join(__dirname, 'gemas-logo-original.png')

const targets = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon.png', size: 64 },
]

for (const { file, size } of targets) {
  await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, file))
  console.log(`✓ ${file} (${size}x${size})`)
}
