/**
 * Crop/rotate helper for chat image attachments (the edit sheet before send).
 * Also caps the longest side at MAX_DIM, so a 12MP phone photo doesn't go up
 * the wire at full size — a crop you can't see on a phone screen anyway.
 */

export type PixelCrop = { x: number; y: number; width: number; height: number }

export const MAX_DIM = 2048
export const JPEG_QUALITY = 0.88

/** Size of the box that holds a w×h image rotated by `deg`. */
export function rotatedBounds(width: number, height: number, deg: number): { width: number; height: number } {
  const rad = (deg * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    width: Math.round(width * cos + height * sin),
    height: Math.round(width * sin + height * cos),
  }
}

/** Output dimensions for a crop, scaled down (never up) so the longest side is at most `maxDim`. */
export function scaledSize(width: number, height: number, maxDim = MAX_DIM): { width: number; height: number; scale: number } {
  const longest = Math.max(width, height)
  const scale = longest > maxDim ? maxDim / longest : 1
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale }
}

/** "IMG_1234.HEIC" → "IMG_1234.jpg" */
export function jpegName(name: string): string {
  const base = name.replace(/\.[^./]+$/, '') || 'photo'
  return `${base}.jpg`
}

/** GIFs are skipped (cropping would drop the animation); everything else image/* is editable. */
export function isEditableImage(file: { type: string }): boolean {
  return file.type.startsWith('image/') && file.type !== 'image/gif'
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

/**
 * Draws the rotated image onto a canvas, cuts out `crop` (in rotated-image
 * pixels, as react-easy-crop reports it) and returns a JPEG.
 */
export async function cropImage(src: string, crop: PixelCrop, rotation: number, name: string): Promise<File> {
  const img = await loadImage(src)
  const bounds = rotatedBounds(img.naturalWidth, img.naturalHeight, rotation)

  const full = document.createElement('canvas')
  full.width = bounds.width
  full.height = bounds.height
  const fctx = full.getContext('2d')
  if (!fctx) throw new Error('Canvas not supported')
  fctx.translate(bounds.width / 2, bounds.height / 2)
  fctx.rotate((rotation * Math.PI) / 180)
  fctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

  const out = scaledSize(crop.width, crop.height)
  const canvas = document.createElement('canvas')
  canvas.width = out.width
  canvas.height = out.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  // JPEG has no alpha: paint white first so transparent PNGs don't go black.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(full, crop.x, crop.y, crop.width, crop.height, 0, 0, out.width, out.height)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('Could not export image')
  return new File([blob], jpegName(name), { type: 'image/jpeg' })
}
