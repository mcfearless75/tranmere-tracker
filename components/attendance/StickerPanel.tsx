'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Check, Download } from 'lucide-react'
import { stickerUrl } from '@/lib/attendance/stickerUrl'

/**
 * Admin-only: the canonical check-in link for the current NFC token, plus a
 * QR of it. Used to program NFC tags, set a dynamic QR's destination, or
 * print a card. Regenerates itself whenever the token changes.
 */
export function StickerPanel({ token }: { token: string }) {
  const url = stickerUrl(token)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: 'M' })
      .then(data => { if (!cancelled) setQr(data) })
      .catch(() => { if (!cancelled) setQr(null) })
    return () => { cancelled = true }
  }, [url])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (older WebView) — the URL is selectable below.
    }
  }

  return (
    <div data-testid="sticker-panel" className="mt-3 space-y-3 border-t pt-3">
      <div>
        <p className="text-xs font-semibold text-tranmere-blue">Check-in link for stickers</p>
        <p className="text-[11px] text-muted-foreground">
          Write this to NFC tags and set it as the destination of the QR card. Nothing else, no tracking parameters.
        </p>
      </div>
      <div className="flex items-start gap-2">
        <code data-testid="sticker-url" className="flex-1 text-xs bg-gray-100 border rounded-lg px-2.5 py-1.5 break-all select-all">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 text-xs font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-2.5 py-1.5 rounded-lg shrink-0"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {qr && (
        <div className="flex items-center gap-4">
          {/* Data URL from the qrcode lib — next/image adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code for the check-in link" width={160} height={160} className="border rounded-lg bg-white" />
          <a
            href={qr}
            download="check-in-sticker-qr.png"
            className="flex items-center gap-1 text-xs font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-2.5 py-1.5 rounded-lg"
          >
            <Download size={13} /> Download PNG
          </a>
        </div>
      )}
    </div>
  )
}
