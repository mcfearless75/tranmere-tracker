import { isHeicFile } from '@/lib/media/heic'

describe('isHeicFile', () => {
  it('detects image/heic MIME type', () => {
    expect(isHeicFile({ type: 'image/heic', name: 'IMG_1234.HEIC' })).toBe(true)
  })

  it('detects image/heif MIME type', () => {
    expect(isHeicFile({ type: 'image/heif', name: 'photo' })).toBe(true)
  })

  it('detects a .heic extension when the MIME type is empty (some iOS browsers)', () => {
    expect(isHeicFile({ type: '', name: 'IMG_5678.heic' })).toBe(true)
  })

  it('detects a .heif extension case-insensitively', () => {
    expect(isHeicFile({ type: '', name: 'photo.HEIF' })).toBe(true)
  })

  it('does not flag a normal jpeg', () => {
    expect(isHeicFile({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(false)
  })

  it('does not flag a png with no extension info', () => {
    expect(isHeicFile({ type: 'image/png', name: 'avatar.png' })).toBe(false)
  })

  it('does not false-positive on a filename that merely contains "hei"', () => {
    expect(isHeicFile({ type: 'image/jpeg', name: 'height-chart.jpg' })).toBe(false)
  })
})
