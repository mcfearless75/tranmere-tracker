/** Longest edge, in pixels, of a photo sent in chat. Plenty for a phone
 *  screen, and turns a 2–8 MB camera photo into a few hundred KB — the
 *  difference between an instant send and a stalled one on weak signal. */
export const CHAT_IMAGE_MAX_EDGE = 1600
const JPEG_QUALITY = 0.8

/** Types the browser can redraw to a canvas without losing anything that
 *  matters. GIFs would lose their animation; anything else (HEIC on
 *  non-Safari, SVG) is passed through untouched. */
const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
    img.src = url
  })
}

/**
 * Downscale a chat photo before upload. Never throws: any failure (decode,
 * canvas, toBlob) falls back to the original file, so compression can only
 * ever make a send smaller, never make it fail.
 */
export async function compressChatImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.has(file.type)) return file
  try {
    const img = await loadImage(file)
    const scale = Math.min(1, CHAT_IMAGE_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
