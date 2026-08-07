'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle, Loader2, Sun, Moon, Utensils, type LucideIcon } from 'lucide-react'
import type { AttendancePhase } from '@/lib/attendance/phase'

type State = 'working' | 'success' | 'already' | 'error'

interface Props {
  phase: AttendancePhase
  nfcToken: string
}

const PHASE_UI: Record<AttendancePhase, { icon: LucideIcon; working: string; success: string }> = {
  am:    { icon: Sun,      working: 'Checking you in…',        success: 'Morning sorted ✓' },
  lunch: { icon: Utensils, working: 'Logging your lunch tap…', success: 'Lunch sorted ✓' },
  pm:    { icon: Moon,     working: 'Checking you out…',       success: 'End of day sorted ✓' },
}

/**
 * Fires automatically when the app is opened via the NFC board App Link
 * (/attendance?tag=TOKEN). Grabs a GPS fix, submits the check-in, shows a tick.
 * Student does nothing beyond tapping the board.
 */
export function AutoCheckIn({ phase, nfcToken }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>('working')
  const [error, setError] = useState('')
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    async function run() {
      // Best-effort GPS (audit only — NFC tap is the proof). Never blocks.
      const geo = await new Promise<{ lat: number; lng: number; accuracy: number } | null>(resolve => {
        if (!('geolocation' in navigator)) { resolve(null); return }
        const timer = setTimeout(() => resolve(null), 6000)
        navigator.geolocation.getCurrentPosition(
          pos => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }) },
          () => { clearTimeout(timer); resolve(null) },
          { enableHighAccuracy: true, timeout: 5000 },
        )
      })

      try {
        const res = await fetch('/api/attendance/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phase,
            nfc_token:      nfcToken,
            geo_lat:        geo?.lat ?? null,
            geo_lng:        geo?.lng ?? null,
            geo_accuracy_m: geo?.accuracy ? Math.round(geo.accuracy) : null,
            selfie_path:    null,
          }),
        })
        const json = await res.json()
        // Duplicate tap — not an error, just reassure and send them on.
        if (json.alreadyCheckedIn) {
          setState('already')
          setTimeout(() => { router.push('/attendance'); router.refresh() }, 2500)
          return
        }
        if (!json.ok) { setError(json.error ?? 'Check-in failed'); setState('error'); return }
        setState('success')
        setTimeout(() => { router.push('/attendance'); router.refresh() }, 2500)
      } catch {
        setError('Network error — try again')
        setState('error')
      }
    }

    run()
  }, [phase, nfcToken, router])

  const ui = PHASE_UI[phase]
  const PhaseIcon = ui.icon

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-center px-4">
        <CheckCircle size={72} className="text-green-500" />
        <h1 className="text-2xl font-bold text-tranmere-blue">{ui.success}</h1>
        <p className="text-sm text-muted-foreground">
          Checked in at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
        </p>
      </div>
    )
  }

  if (state === 'already') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-center px-4">
        <CheckCircle size={72} className="text-tranmere-blue" />
        <h1 className="text-2xl font-bold text-tranmere-blue">Already checked in</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re already checked in for this session — nothing else to do.
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-center px-4">
        <AlertCircle size={48} className="text-red-500" />
        <h1 className="text-xl font-bold text-red-600">Check-in failed</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => { router.push('/attendance'); router.refresh() }}
          className="bg-tranmere-blue text-white px-6 py-3 rounded-xl font-semibold"
        >
          Back
        </button>
      </div>
    )
  }

  // working
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4">
      <div className="w-20 h-20 rounded-full bg-tranmere-blue/10 flex items-center justify-center">
        <PhaseIcon size={40} className="text-tranmere-blue" />
      </div>
      <h1 className="text-xl font-bold text-tranmere-blue">{ui.working}</h1>
      <Loader2 size={28} className="animate-spin text-tranmere-blue" />
    </div>
  )
}
