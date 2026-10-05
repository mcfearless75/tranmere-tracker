import { compressChatImage } from '@/lib/chat/compressImage'

beforeEach(() => {
  global.URL.createObjectURL = jest.fn(() => 'blob:x')
  global.URL.revokeObjectURL = jest.fn()
})

describe('compressChatImage', () => {
  it('passes GIFs through untouched so animation is kept', async () => {
    const gif = new File(['g'], 'a.gif', { type: 'image/gif' })
    expect(await compressChatImage(gif)).toBe(gif)
  })

  it('passes non-image files through untouched', async () => {
    const pdf = new File(['p'], 'a.pdf', { type: 'application/pdf' })
    expect(await compressChatImage(pdf)).toBe(pdf)
  })

  it('falls back to the original photo when it cannot be decoded, never throwing', async () => {
    const RealImage = global.Image
    global.Image = class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_v: string) { setTimeout(() => this.onerror?.(), 0) }
    } as unknown as typeof Image
    try {
      const jpg = new File(['j'], 'a.jpg', { type: 'image/jpeg' })
      expect(await compressChatImage(jpg)).toBe(jpg)
    } finally {
      global.Image = RealImage
    }
  })
})
