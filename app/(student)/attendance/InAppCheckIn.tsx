'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  CheckCircle, AlertCircle, Loader2, Sun, Moon,
  Smartphone, QrCode, X,
} from 'lucide-react'

type Phase = 'am' | 'pm'
type ScanState = 'idle' | 'nfc' | 'qr' | 'submitting' | 'success' | 'error'

interface Props {
  phase: Phase
  onSuccess: (checkedAt: string) => void
}

function extractToken(raw: string): string | null {
  try { return new URL(raw).searchParams.get('tag') } catch { return null }
}

export function InAppCheckIn({ phase, onSuccess }: Props) {
  const [state, setState]   = useState<ScanState>('idle')
  const [error, setError]   = useState('')
  const [geo, setGeo]       = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const nfcAbortRef         = useRef<AbortController | null>(null)
  const qrScannerRef        = useRef<unknown>(null)
  const qrStartedRef        = useRef(false)

  const PhaseIcon  = phase === 'am' ? Sun : Moon
  const phaseLabel = phase === 'am' ? 'Morning Check-in' : 'End of Day Check-out'

  // Grab GPS quietly in the background
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      )
    }
  }, [])

  const submitCheckIn = useCallback(async (token: string) => {
    setState('submitting')
    setError('')
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          nfc_token:      token,
          geo_lat:        geo?.lat ?? null,
          geo_lng:        geo?.lng ?? null,
          geo_accuracy_m: geo?.accuracy ? Math.round(geo.accuracy) : null,
          selfie_path:    null,
        }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error ?? 'Check-in failed'); setState('error'); return }
      setState('success')
      onSuccess(new Date().toISOString())
    } catch {
      setError('Network error — try again')
      setState('error')
    }
  }, [phase, geo, onSuccess])

  // ── NFC ────────────────────────────────────────────────────────────────────
  const stopNfc = useCallback(() => {
    nfcAbortRef.current?.abort()
    nfcAbortRef.current = null
  }, [])

  const startNfc = useCallback(async () => {
    if (!('NDEFReader' in window)) return false
    setState('nfc')
    try {
      const abort = new AbortController()
      nfcAbortRef.current = abort
      // @ts-expect-error Web NFC not in TS lib
      const ndef = new window.NDEFReader()
      await ndef.scan({ signal: abort.signal })
      ndef.addEventListener('reading', ({ message }: { message: { records: Array<{ recordType: string; data: DataView; mediaType?: string }> } }) => {
        for (const record of message.records) {
          // Handle both 'url' and 'text' record types
          if (record.recordType === 'url' || record.recordType === 'absolute-url') {
            const token = extractToken(new TextDecoder().decode(record.data))
            if (token) { stopNfc(); submitCheckIn(token); return }
          }
          if (record.recordType === 'text') {
            const text = new TextDecoder().decode(record.data)
            const token = extractToken(text)
            if (token) { stopNfc(); submitCheckIn(token); return }
          }
        }
      })
      return true
    } catch {
      // NFC permission denied or not available — fall back to QR
      setState('qr')
      return false
    }
  }, [stopNfc, submitCheckIn])

  // ── QR — initialized via useEffect so the div is in the DOM ───────────────
  const stopQr = useCallback(async () => {
    if (qrScannerRef.current) {
      // @ts-expect-error html5-qrcode types
      await qrScannerRef.current.stop().catch(() => {})
      // @ts-expect-error html5-qrcode types
      qrScannerRef.current.clear?.()
      qrScannerRef.current = null
    }
    qrStartedRef.current = false
  }, [])

  // This effect runs AFTER React renders the #tt-qr-reader div into the DOM
  useEffect(() => {
    if (state !== 'qr' || qrStartedRef.current) return
    qrStartedRef.current = true

    let cancelled = false

    async function init() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode('tt-qr-reader')
        qrScannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decoded: string) => {
            const token = extractToken(decoded)
            if (token) { await stopQr(); submitCheckIn(token) }
          },
          () => {},
        )
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Camera failed'
        setError(msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')
          ? 'Camera permission denied — enable in browser settings'
          : `Camera error: ${msg}`)
        setState('error')
        qrStartedRef.current = false
      }
    }

    init()
    return () => { cancelled = true }
  }, [state, stopQr, submitCheckIn])

  const handleCheckIn = useCallback(async () => {
    if ('NDEFReader' in window) { await startNfc() }
    else { setState('qr') }
  }, [startNfc])

  const cancel = useCallback(async () => {
    stopNfc(); await stopQr()
    setState('idle'); setError('')
  }, [stopNfc, stopQr])

  // Cleanup on unmount
  useEffect(() => () => { stopNfc(); stopQr() }, [stopNfc, stopQr])

  // ── Render ──────────────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
        <CheckCircle size={56} className="text-green-500" />
        <p className="text-lg font-bold text-green-700">
          {phase === 'am' ? 'Morning' : 'Evening'} attendance recorded
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    )
  }

  if (state === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <Loader2 size={40} className="animate-spin text-tranmere-blue" />
        <p className="text-sm text-muted-foreground">Recording…</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
        <AlertCircle size={40} className="text-red-500" />
        <p className="text-sm text-red-600 font-medium">{error}</p>
        <button
          onClick={() => { setState('idle'); setError('') }}
          className="bg-tranmere-blue text-white px-6 py-2.5 rounded-xl font-semibold text-sm"
        >
          Try again
        </button>
      </div>
    )
  }

  if (state === 'nfc') {
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <div className="w-24 h-24 rounded-full bg-tranmere-blue/10 flex items-center justify-center animate-pulse">
          <Smartphone size={44} className="text-tranmere-blue" />
        </div>
        <div>
          <p className="font-bold text-tranmere-blue text-lg">Hold phone to the sign</p>
          <p className="text-xs text-muted-foreground mt-1">Keep the app open — tap the NFC panel</p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={() => { stopNfc(); setState('qr') }}
            className="flex items-center justify-center gap-2 border border-tranmere-blue text-tranmere-blue py-3 rounded-xl text-sm font-semibold"
          >
            <QrCode size={16} /> Scan QR code instead
          </button>
          <button onClick={cancel} className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-2 min-h-[44px]">
            <X size={14} /> Cancel
          </button>
        </div>
      </div>
    )
  }

  if (state === 'qr') {
    const hasNfc = typeof window !== 'undefined' && 'NDEFReader' in window
    return (
      <div className="flex flex-col gap-3">
        <p className="text-center text-sm font-semibold text-tranmere-blue">Point camera at the QR code on the sign</p>
        {/* This div must exist before the useEffect initialises the scanner */}
        <div id="tt-qr-reader" className="rounded-2xl overflow-hidden w-full min-h-[260px] bg-gray-100" />
        {hasNfc && (
          <button
            onClick={() => { stopQr(); startNfc() }}
            className="flex items-center justify-center gap-2 border border-tranmere-blue text-tranmere-blue py-3 rounded-xl text-sm font-semibold"
          >
            <Smartphone size={16} /> Use NFC instead
          </button>
        )}
        <button onClick={cancel} className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-2 min-h-[44px]">
          <X size={14} /> Cancel
        </button>
      </div>
    )
  }

  // idle — main CTA
  return (
    <button
      onClick={handleCheckIn}
      className="w-full flex items-center justify-center gap-2.5 bg-tranmere-blue text-white font-bold py-4 rounded-2xl text-base active:scale-[0.98] transition-transform shadow-sm"
    >
      <PhaseIcon size={20} />
      {phaseLabel}
    </button>
  )
}
