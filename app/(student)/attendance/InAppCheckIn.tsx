'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CheckCircle, AlertCircle, Loader2, Sun, Moon, Utensils, MapPin, type LucideIcon } from 'lucide-react'
import type { AttendancePhase } from '@/lib/attendance/phase'

type ScanState = 'idle' | 'locating' | 'submitting' | 'success' | 'already' | 'error'

interface Props {
  phase: AttendancePhase
  onSuccess: (checkedAt: string) => void
}

const PHASE_UI: Record<AttendancePhase, { icon: LucideIcon; button: string; success: string }> = {
  am:    { icon: Sun,      button: 'Morning Check-in',      success: 'Morning attendance recorded' },
  lunch: { icon: Utensils, button: 'Lunch Check-in',        success: 'Lunch sorted ✓' },
  pm:    { icon: Moon,     button: 'End of Day Check-out',  success: 'End of day recorded' },
}

export function InAppCheckIn({ phase, onSuccess }: Props) {
  const [state, setState] = useState<ScanState>('idle')
  const [error, setError] = useState('')
  const geoRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null)

  const ui = PHASE_UI[phase]
  const PhaseIcon = ui.icon

  // Start acquiring GPS as soon as component mounts — reduces wait on tap
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        geoRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  const handleCheckIn = useCallback(async () => {
    setState('locating')
    setError('')

    // Try to get a fresh GPS fix (up to 8s); fall back to cached or null
    const geo = await new Promise<{ lat: number; lng: number; accuracy: number } | null>(resolve => {
      if (!('geolocation' in navigator)) { resolve(geoRef.current); return }
      const timer = setTimeout(() => resolve(geoRef.current), 8000)
      navigator.geolocation.getCurrentPosition(
        pos => {
          clearTimeout(timer)
          const g = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
          geoRef.current = g
          resolve(g)
        },
        () => { clearTimeout(timer); resolve(geoRef.current) },
        { enableHighAccuracy: true, timeout: 7000 },
      )
    })

    setState('submitting')
    try {
      const res = await fetch('/api/attendance/tap-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          geo_lat:        geo?.lat ?? null,
          geo_lng:        geo?.lng ?? null,
          geo_accuracy_m: geo?.accuracy ? Math.round(geo.accuracy) : null,
        }),
      })
      const json = await res.json()
      // Duplicate tap — friendly reassurance, not an error.
      if (json.alreadyCheckedIn) { setState('already'); return }
      if (!json.ok) { setError(json.error ?? 'Check-in failed'); setState('error'); return }
      setState('success')
      onSuccess(new Date().toISOString())
    } catch {
      setError('Network error — check your connection and try again')
      setState('error')
    }
  }, [phase, onSuccess])

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
        <CheckCircle size={56} className="text-green-500" />
        <p className="text-lg font-bold text-green-700">{ui.success}</p>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
        </p>
      </div>
    )
  }

  if (state === 'already') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
        <CheckCircle size={56} className="text-tranmere-blue" />
        <p className="text-lg font-bold text-tranmere-blue">Already checked in for this session</p>
        <p className="text-xs text-muted-foreground">Nothing else to do — you&apos;re all set.</p>
      </div>
    )
  }

  if (state === 'locating') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <MapPin size={36} className="text-tranmere-blue animate-bounce" />
        <p className="text-sm font-semibold text-tranmere-blue">Getting your location…</p>
        <p className="text-xs text-muted-foreground">Hold still for a moment</p>
      </div>
    )
  }

  if (state === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <Loader2 size={40} className="animate-spin text-tranmere-blue" />
        <p className="text-sm text-muted-foreground">Recording attendance…</p>
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

  // idle
  return (
    <div className="space-y-2">
      <button
        onClick={handleCheckIn}
        className="w-full flex items-center justify-center gap-2.5 bg-tranmere-blue text-white font-bold py-4 rounded-2xl text-base active:scale-[0.98] transition-transform shadow-sm"
      >
        <PhaseIcon size={20} />
        {ui.button}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground text-center">
        <MapPin size={12} className="shrink-0" />
        Only works at the academy — your location is checked when you tap.
      </p>
    </div>
  )
}
