'use client'

import { useEffect, useRef } from 'react'
import type { FoodItem } from '@/lib/openFoodFacts'
import { parseFoodItem } from '@/lib/openFoodFacts'

type Props = { onResult: (item: FoodItem) => void; onClose: () => void }

export function BarcodeScanner({ onResult, onClose }: Props) {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let scanner: { clear: () => void; render: (success: (code: string) => Promise<void>, error: () => void) => void } | undefined
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      scanner = new Html5QrcodeScanner(
        'barcode-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      )
      scanner.render(async (barcode: string) => {
        try {
          await scanner?.clear()
        } catch {}
        const res = await fetch(`/api/food/search?barcode=${encodeURIComponent(barcode)}`)
        const products = await res.json()
        if (products[0]) {
          onResult(parseFoodItem(products[0], 100))
        } else {
          alert('Product not found in database. Try searching by name.')
        }
        onClose()
      }, () => {})
    })

    return () => {
      if (scanner) { try { scanner.clear() } catch {} }
    }
  }, [onResult, onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Scan Barcode</h2>
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground px-3 py-1 rounded-lg hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        <div id="barcode-reader" className="w-full" />
        <p className="text-xs text-muted-foreground text-center mt-3">
          Point camera at a food product barcode
        </p>
      </div>
    </div>
  )
}
