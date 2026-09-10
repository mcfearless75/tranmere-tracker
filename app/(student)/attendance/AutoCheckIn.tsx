'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle, Loader2, Sun, Moon, Utensils, type LucideIcon } from 'lucide-react'
import type { AttendancePhase } from '@/lib/attendance/phase'
import { getGeoFix, type GeoDiagnostic } from '@/lib/attendance/getGeoFix'
import { reportClientError } from '@/lib/reportClientError'

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
 * Shown under the tick when the browser refused location. Plain, phone-first
 * instructions — the student is standing at reception with 30 seconds.
 */
function LocationDeniedNotice({ onDone }: { onDone: () => void }) {
  return (
    <div
      role="status"
      data-testid="location-denied-notice"
      className="mt-2 w-full max-w-sm rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left space-y-2"
    >
      <p className="text-sm font-semibold text-amber-900">Location is switched off for this site</p>
      <p className="text-xs text-amber-900/90">
        You&apos;re checked in, but without location it&apos;s marked for a coach to review every time.
        Takes 10 seconds to fix:
      </p>
      <ul className="text-xs text-amber-900/90 list-disc pl-4 space-y-1">
        <li><span className="font-medium">iPhone (Safari):</span> tap <span className="font-mono">AA</span> in the address bar → Website Settings → Location → Allow.</li>
        <li><span className="font-medium">Android (Chrome):</span> tap the lock icon → Permissions → Location → Allow.</li>
      </ul>
      <button
        onClick={onDone}
        className="mt-1 w-full bg-tranmere-blue text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
      >
        Done
      </button>
    </div>
  )
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
  // The browser refused location outright (iOS Safari replays a remembered
  // per-site "Don't Allow" instantly, with no prompt). The check-in still
  // goes through, flagged — but the student has to be TOLD, or they never
  // find out and every tap for the rest of term is flagged the same way.
  const [locationDenied, setLocationDenied] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    async function run() {
      // Best-effort GPS (audit only — NFC tap is the proof). Never blocks the
      // check-in itself — the RPC flags-not-rejects on missing GPS. A
      // high-accuracy-only attempt still flagged 100% of AM check-ins on
      // 2026-09-08 despite an earlier timeout extension (5-6s -> 12-13s) —
      // more time doesn't help a GPS chip that physically can't get a
      // satellite lock indoors near reception on a cold first-tap-of-the-day.
      // getGeoFix falls back to fast network-based positioning, which works
      // indoors — see its own doc comment for the full incident history.
      // onDiagnostic: still ~54% flagged after the fallback landed —
      // permission-denied and still-timed-out look identical as a bare null
      // in daily_attendance, and need opposite fixes. Report which actually
      // happened so the next batch of real check-ins answers that.
      //
      // 2026-09-10: that data came in — every remaining flag on this path is
      // permission-denied (both attempts), not a timeout. Cause (deep-dive
      // the same day): the QR sticker sends students to
      // tranmeretracker.vercel.app, a domain they don't recognise, and the
      // location prompt fires on page load with no explanation. iOS Safari
      // remembers one "Don't Allow" per site and replays it instantly on
      // every later tap — 25 students in 48h. (The utm_source=QRCodeGeneratorHub
      // in the URL is baked into the QR code and shows up on every scan,
      // including iOS Camera → real Safari; it does not indicate a
      // third-party in-app browser.) Forward the reason so staff see it,
      // and — the part that actually fixes it — tell the student how to
      // switch location back on (see the success screen below).
      let diagnostic: GeoDiagnostic | null = null
      const geo = await getGeoFix({ onDiagnostic: d => { diagnostic = d } })
      if (!geo && diagnostic) {
        reportClientError(new Error(`getGeoFix failed: ${JSON.stringify(diagnostic)}`), 'checkin-geo-diagnostic')
      }
      const geoPermissionDenied = (diagnostic as GeoDiagnostic | null)?.highAccuracy === 'permission-denied'
      if (geoPermissionDenied) setLocationDenied(true)

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
            geo_permission_denied: geoPermissionDenied,
          }),
        })
        const json = await res.json()
        // Duplicate tap — not an error, just reassure and send them on.
        if (json.alreadyCheckedIn) {
          setState('already')
          // Single replace(), not push()+refresh(): firing refresh() in the
          // same tick as a navigation refetches the OLD tree while the new
          // one is being swapped in — a documented way to hit Next 14's
          // "parallelRoutes.get of null" router crash, and this page's URL
          // (/attendance?tag=…) is one of the three where it was recorded
          // in production. /attendance is force-dynamic, so a plain
          // navigation already fetches fresh data.
          // When location was denied, stay on the success screen so the
          // student can read how to fix it — they leave via the button.
          if (!geoPermissionDenied) setTimeout(() => router.replace('/attendance'), 2500)
          return
        }
        if (!json.ok) { setError(json.error ?? 'Check-in failed'); setState('error'); return }
        setState('success')
        // Same as the already-checked-in branch above: one replace(), and
        // hold the screen when location was denied so the fix-it notice
        // is actually readable.
        if (!geoPermissionDenied) setTimeout(() => router.replace('/attendance'), 2500)
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
        {locationDenied && <LocationDeniedNotice onDone={() => router.replace('/attendance')} />}
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
        {locationDenied && <LocationDeniedNotice onDone={() => router.replace('/attendance')} />}
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
          onClick={() => router.replace('/attendance')}
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
