import { rotatedBounds, scaledSize, jpegName, isEditableImage, MAX_DIM } from '@/lib/chat/cropImage'

describe('rotatedBounds', () => {
  it('keeps size at 0/180 and swaps at 90/270', () => {
    expect(rotatedBounds(400, 300, 0)).toEqual({ width: 400, height: 300 })
    expect(rotatedBounds(400, 300, 90)).toEqual({ width: 300, height: 400 })
    expect(rotatedBounds(400, 300, 180)).toEqual({ width: 400, height: 300 })
    expect(rotatedBounds(400, 300, 270)).toEqual({ width: 300, height: 400 })
  })
})

describe('scaledSize', () => {
  it('never upscales small crops', () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600, scale: 1 })
  })
  it('caps the longest side at MAX_DIM, keeping aspect', () => {
    const s = scaledSize(4032, 3024)
    expect(s.width).toBe(MAX_DIM)
    expect(s.height).toBe(1536)
  })
  it('works for portrait', () => {
    expect(scaledSize(3024, 4032).height).toBe(MAX_DIM)
  })
})

describe('jpegName', () => {
  it('swaps the extension', () => {
    expect(jpegName('IMG_1234.HEIC')).toBe('IMG_1234.jpg')
    expect(jpegName('team.photo.png')).toBe('team.photo.jpg')
    expect(jpegName('noext')).toBe('noext.jpg')
  })
})

describe('isEditableImage', () => {
  it('edits photos but not GIFs or documents', () => {
    expect(isEditableImage({ type: 'image/jpeg' })).toBe(true)
    expect(isEditableImage({ type: 'image/heic' })).toBe(true)
    expect(isEditableImage({ type: 'image/gif' })).toBe(false)
    expect(isEditableImage({ type: 'application/pdf' })).toBe(false)
  })
})
