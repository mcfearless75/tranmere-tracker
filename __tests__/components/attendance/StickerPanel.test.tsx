import { render, screen, waitFor } from '@testing-library/react'
import { stickerUrl, CANONICAL_APP_ORIGIN } from '@/lib/attendance/stickerUrl'

const toDataURL = jest.fn()
jest.mock('qrcode', () => ({ __esModule: true, default: { toDataURL: (...a: unknown[]) => toDataURL(...a) } }))

import { StickerPanel } from '@/components/attendance/StickerPanel'

const TOKEN = '9af4a580bbe347c5aacc551ba56e75c5'

describe('stickerUrl', () => {
  it('builds the canonical link with only the tag', () => {
    expect(stickerUrl(TOKEN)).toBe(`${CANONICAL_APP_ORIGIN}/attendance?tag=${TOKEN}`)
  })
  it('trims and encodes the token', () => {
    expect(stickerUrl('  a b ')).toBe(`${CANONICAL_APP_ORIGIN}/attendance?tag=a+b`)
  })
  it('never points at the legacy host', () => {
    expect(stickerUrl(TOKEN)).not.toContain('vercel.app')
    expect(stickerUrl(TOKEN)).not.toContain('utm_')
  })
})

describe('StickerPanel', () => {
  beforeEach(() => {
    toDataURL.mockReset()
    toDataURL.mockResolvedValue('data:image/png;base64,QUJD')
  })

  it('shows the canonical link and a QR of exactly that link', async () => {
    render(<StickerPanel token={TOKEN} />)
    expect(screen.getByTestId('sticker-url')).toHaveTextContent(`${CANONICAL_APP_ORIGIN}/attendance?tag=${TOKEN}`)

    const img = await screen.findByAltText('QR code for the check-in link')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,QUJD')
    expect(toDataURL).toHaveBeenCalledWith(`${CANONICAL_APP_ORIGIN}/attendance?tag=${TOKEN}`, expect.objectContaining({ width: 512 }))

    const download = screen.getByRole('link', { name: /download png/i })
    expect(download).toHaveAttribute('download', 'check-in-sticker-qr.png')
  })

  it('still shows the link when QR generation fails', async () => {
    toDataURL.mockRejectedValue(new Error('no canvas'))
    render(<StickerPanel token={TOKEN} />)
    expect(screen.getByTestId('sticker-url')).toBeInTheDocument()
    await waitFor(() => expect(toDataURL).toHaveBeenCalled())
    expect(screen.queryByAltText('QR code for the check-in link')).not.toBeInTheDocument()
  })
})
