'use client'

import { useState } from 'react'
import { MapPin, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { isNative } from '@/lib/native'

// Training ground coordinates — override via env if needed
const GROUND_LAT  = parseFloat(process.env.NEXT_PUBLIC_GROUND_LAT  ?? '53.4089')
const GROUND_LNG  = parseFloat(process.env.NEXT_PUBLIC_GROUND_LNG  ?? '-3.1067')
const RADIUS_M    = parseInt(process.env.NEXT_PUBLIC_GROUND_RADIUS_M ?? '300', 10)

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type CheckInPeriod = 'am' | 'pm'
type State = 'idle' | 'locating' | 'checking_in' | 'success' | 'too_far' | 'denied' | 'error' | 'unsupported'

interface GeolocationResult {
  lat: number
  lng: number
  accuracy: number
}

/** Get current position via Capacitor (native) or browser Geolocation API (web). */
async function getCurrentPosition(): Promise<GeolocationResult> {
  if (isNative()) {
    // Dynamically import so the web build never bundles the native plugin
    const { Geolocation } = await import('@capacitor/geolocation')
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    })
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    }
  }

  // Web browser fallback
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

interface Props {
  period: CheckInPeriod
  alreadyCheckedIn: boolean
}

export function GeofenceCheckIn({ period, alreadyCheckedIn }: Props) {
  const [state, setState] = useState<State>(alreadyCheckedIn ? 'success' : 'idle')
  const [distanceM, setDistanceM] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Hide on web if Geolocation is unavailable (native always has it)
  if (
    typeof window !== 'undefined' &&
    !isNative() &&
    !('geolocation' in navigator)
  ) {
    return null
  }

  async function handleCheckIn() {
    setState('locating')
    setErrorMsg('')

    try {
      const pos = await getCurrentPosition()
      const dist = haversineMetres(pos.lat, pos.lng, GROUND_LAT, GROUND_LNG)
      setDistanceM(Math.round(dist))

      if (dist > RADIUS_M) {
        setState('too_far')
        return
      }

      setState('checking_in')
      const res = await fetch('/api/attendance/geo-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Check-in failed')
      }

      setState('success')
    } catch (err: unknown) {
      // Web Geolocation permission denied
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as GeolocationPositionError).code === (err as GeolocationPositionError).PERMISSION_DENIED
      ) {
        setState('denied')
        return
      }
      if (err instanceof Error && err.message === 'unsupported') {
        setState('unsupported')
        return
      }
      setErrorMsg(err instanceof Error ? err.message : 'Check-in failed')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="flex items-center gap-2 text-xs text-green-700 font-semibold">
        <CheckCircle2 size={14} className="shrink-0" />
        {period === 'am' ? 'Checked in' : 'Checked out'} ✓
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
        <AlertTriangle size={12} className="shrink-0" />
        Location blocked — enable in {isNative() ? 'app settings' : 'browser settings'}
      </div>
    )
  }

  if (state === 'too_far') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-red-600">
        <XCircle size={12} className="shrink-0" />
        {distanceM !== null ? `${distanceM}m away` : 'Too far from ground'}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <button onClick={handleCheckIn} className="flex items-center gap-1.5 text-[11px] text-red-600 hover:underline">
        <AlertTriangle size={12} /> {errorMsg || 'Failed'} — tap to retry
      </button>
    )
  }

  const isLoading = state === 'locating' || state === 'checking_in'
  const label = period === 'am' ? 'Check in' : 'Check out'

  return (
    <button
      onClick={handleCheckIn}
      disabled={isLoading}
      className="flex items-center gap-1.5 text-xs font-semibold text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 active:bg-white/30 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60"
    >
      {isLoading
        ? <Loader2 size={12} className="animate-spin shrink-0" />
        : <MapPin size={12} className="shrink-0" />}
      {isLoading ? (state === 'locating' ? 'Locating…' : 'Checking in…') : label}
    </button>
  )
}
