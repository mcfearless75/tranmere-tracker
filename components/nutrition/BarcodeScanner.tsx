'use client'

import { useEffect, useRef, useState } from 'react'
import type { FoodItem } from '@/lib/openFoodFacts'
import { parseFoodItem } from '@/lib/openFoodFacts'
import { X } from 'lucide-react'

type Props = { onResult: (item: FoodItem) => void; onClose: () => void }

export function BarcodeScanner({ onResult, onClose }: Props) {
  const started = useRef(false)
  const scannerRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'scanning' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false

    ;(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return

        const scanner = new Html5Qrcode('barcode-reader-live')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },   // back camera
          { fps: 10, qrbox: { width: 280, height: 180 } },
          async (decoded: string) => {
            try { await scanner.stop() } catch {}
            try { await scanner.clear() } catch {}
            const res = await fetch(`/api/food/search?barcode=${encodeURIComponent(decoded)}`)
            const products = await res.json()
            if (products[0]) {
              onResult(parseFoodItem(products[0], 100))
            } else {
              alert(`Barcode ${decoded} not found. Try search by name instead.`)
            }
            onClose()
          },
          () => { /* per-frame failures — ignore */ },
        )
        setStatus('scanning')
      } catch (err: any) {
        const msg = err?.message ?? String(err)
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
          setError('Camera permission denied. Enable it in your browser settings and try again.')
        } else if (msg.toLowerCase().includes('notfound') || msg.toLowerCase().includes('no camera')) {
          setError('No camera found on this device.')
        } else {
          setError(msg)
        }
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current.clear().catch(() => {})
      }
    }
  }, [onResult, onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 backdrop-blur">
        <h2 className="font-semibold text-white">Scan Barcode</h2>
        <button
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <X size={18} />
        </button>
      </div>

      {/* Camera view */}
      <div className="relative flex-1 flex items-center justify-center">
        <div id="barcode-reader-live" className="w-full h-full" />

        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black">
            <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mb-3" />
            <p className="text-sm">Requesting camera…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black p-6 text-center">
            <p className="font-semibold text-red-400 mb-2">Camera unavailable</p>
            <p className="text-sm text-white/80 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Close
            </button>
          </div>
        )}

        {/* Guide overlay */}
        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative w-72 h-44">
              <div className="absolute inset-0 border-2 border-white/40 rounded-xl" />
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-tranmere-blue rounded-tl" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-tranmere-blue rounded-tr" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-tranmere-blue rounded-bl" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-tranmere-blue rounded-br" />
            </div>
          </div>
        )}
      </div>

      {/* Hint */}
      {status === 'scanning' && (
        <div className="bg-black/70 backdrop-blur px-4 py-3 text-center">
          <p className="text-sm text-white/80">Align the barcode within the frame</p>
        </div>
      )}
    </div>
  )
}
