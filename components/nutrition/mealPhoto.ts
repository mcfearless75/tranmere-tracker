// Client-side validation and compression helpers for the AI meal photo flow.
// Kept as a standalone module so the pure logic is unit-testable without
// rendering the component.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10MB hard cap before compression
export const COMPRESS_MAX_DIMENSION = 1280 // longest edge after downscale
export const COMPRESS_QUALITY = 0.8

const ACCEPTED_PREFIX = 'image/'

export type ValidationResult = { ok: true } | { ok: false; error: string }

/**
 * Validate a user-selected file before it is sent to the AI route.
 * Rejects non-images and files that are too large to process.
 */
export function validateImageFile(file: File): ValidationResult {
  if (!file.type || !file.type.startsWith(ACCEPTED_PREFIX)) {
    return { ok: false, error: 'That file is not an image. Please take or upload a photo.' }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'That image is too large. Please use a photo under 10MB.' }
  }
  return { ok: true }
}

/**
 * Downscale and re-encode an image to JPEG to keep upload size (and AI token
 * cost) down. Falls back to the original file if the browser cannot decode it
 * (e.g. unsupported format) — the server still validates and will surface a
 * clear error if it truly cannot be read.
 */
export async function compressImage(
  file: File,
  maxDimension: number = COMPRESS_MAX_DIMENSION,
  quality: number = COMPRESS_QUALITY,
): Promise<File> {
  // createImageBitmap is the most reliable decode path in modern browsers.
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const { width, height } = bitmap
  const longest = Math.max(width, height)
  const scale = longest > maxDimension ? maxDimension / longest : 1
  const targetW = Math.round(width * scale)
  const targetH = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close?.()

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  if (!blob) return file

  // Only keep the compressed version if it actually saved bytes.
  if (blob.size >= file.size) return file

  const name = file.name.replace(/\.[^.]+$/, '') || 'meal'
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
}
