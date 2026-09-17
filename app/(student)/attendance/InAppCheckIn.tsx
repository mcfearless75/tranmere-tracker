'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle, CloudOff, Loader2, Sun, Moon, Utensils, MapPin, type LucideIcon } from 'lucide-react'
import type { AttendancePhase } from '@/lib/attendance/phase'
import { getGeoFix, type GeoFix, type GeoDiagnostic } from '@/lib/attendance/getGeoFix'
import { reportClientError } from '@/lib/reportClientError'
import { enqueueCheckIn, flushQueuedCheckIn, hasQueuedCheckInToday, type QueuedCheckIn, type SubmitResult } from '@/lib/attendance/checkInQueue'

type ScanState = 'idle' | 'locating' | 'submitting' | 'success' | 'already' | 'error' | 'queued'

interface Props {
  phase: AttendancePhase
  onSuccess: (checkedAt: string) => void
  /**
   * Best-effort notification that the offline queue changed (an attempt was
   * queued, sent, or dropped) — lets PhaseDayCard refresh its "pending"
   * segment-dot indicator without polling localStorage every render.
   */
  onQueueChange?: () => void
}

/** Normalised outcome of one POST to /api/attendance/tap-checkin. */
type SubmitOutcome =
  | { kind: 'success' }
  | { kind: 'alreadyCheckedIn' }
  | { kind: 'serverError'; status: number }
  | { kind: 'rejected'; status: number; error: string }

/**
 * Posts one check-in attempt and classifies the response. A thrown fetch
 * (network genuinely down — DNS failure, no connection, CORS) propagates to
 * the caller unchanged; everything else resolves to a discriminated result
 * so 4xx (definitive rejection: outside fence/window, unauthorised, invalid
 * phase) and 5xx (plausibly transient) can be told apart — both arrive as a
 * normal resolved response, so `res.status` has to be checked explicitly
 * rather than relying on try/catch alone.
 */
async function submitTapCheckIn(
  phase: AttendancePhase,
  geo: { lat: number | null; lng: number | null; accuracy: number | null },
  geoPermissionDenied: boolean,
): Promise<SubmitOutcome> {
  const res = await fetch('/api/attendance/tap-checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase,
      geo_lat: geo.lat,
      geo_lng: geo.lng,
      geo_accuracy_m: geo.accuracy,
      geo_permission_denied: geoPermissionDenied,
    }),
  })
  if (res.status >= 500) return { kind: 'serverError', status: res.status }
  const json = await res.json()
  if (json.alreadyCheckedIn) return { kind: 'alreadyCheckedIn' }
  if (!json.ok) return { kind: 'rejected', status: res.status, error: json.error ?? 'Check-in failed' }
  return { kind: 'success' }
}

/** Adapts the richer SubmitOutcome to the queue module's generic SubmitResult shape. */
function toSubmitResult(outcome: SubmitOutcome): SubmitResult {
  switch (outcome.kind) {
    case 'success': return { ok: true, status: 200 }
    case 'alreadyCheckedIn': return { ok: true, alreadyCheckedIn: true, status: 200 }
    case 'serverError': return { ok: false, status: outcome.status }
    case 'rejected': return { ok: false, status: outcome.status, error: outcome.error }
  }
}

const PHASE_UI: Record<AttendancePhase, { icon: LucideIcon; button: string; success: string }> = {
  am:    { icon: Sun,      button: 'Morning Check-in',      success: 'Morning attendance recorded' },
  lunch: { icon: Utensils, button: 'Lunch Check-in',        success: 'Lunch sorted ✓' },
  pm:    { icon: Moon,     button: 'End of Day Check-out',  success: 'End of day recorded' },
}

export function InAppCheckIn({ phase, onSuccess, onQueueChange }: Props) {
  const router = useRouter()
  const [state, setState] = useState<ScanState>('idle')
  const [error, setError] = useState('')
  const geoRef = useRef<GeoFix | null>(null)

  const ui = PHASE_UI[phase]
  const PhaseIcon = ui.icon

  // Start acquiring GPS as soon as component mounts — reduces wait on tap.
  // This path HARD-REJECTS on missing/out-of-fence GPS (unlike the NFC
  // sticker, which only flags), and end-of-day check-outs are
  // disproportionately indoors (changing rooms, corridor by reception) —
  // much harder for a satellite fix than an outdoor morning arrival.
  // getGeoFix falls back to fast network-based positioning when high-accuracy
  // can't get a fix at all indoors — see its doc comment for the incident
  // history (100% of AM check-ins flagged "No GPS provided" on 2026-09-08
  // even with a generous high-accuracy-only timeout).
  useEffect(() => {
    getGeoFix({ highAccuracyTimeoutMs: 10000, fallbackTimeoutMs: 5000 }).then(fix => {
      if (fix) geoRef.current = fix
    })
  }, [])

  const handleCheckIn = useCallback(async () => {
    setState('locating')
    setError('')

    // Try to get a fresh fix; fall back to the mount-time prewarm's cached
    // one, then to null (which the server hard-rejects on this path).
    let diagnostic: GeoDiagnostic | null = null
    const fresh = await getGeoFix({ onDiagnostic: d => { diagnostic = d } })
    const geo = fresh ?? geoRef.current
    if (geo) geoRef.current = geo

    // The browser flatly refused location (common in a third-party QR-scanner
    // app's embedded in-app browser, which often blocks geolocation entirely
    // and can't be fixed from iOS Settings). Both attempts fail identically
    // in every real sample, so checking highAccuracy alone is sufficient.
    const geoPermissionDenied = (diagnostic as GeoDiagnostic | null)?.highAccuracy === 'permission-denied'

    // See AutoCheckIn.tsx — same still-~54%-flagged follow-up: report which
    // attempt actually failed and why, not just "no coordinates".
    if (!fresh && !geoRef.current && diagnostic) {
      reportClientError(new Error(`getGeoFix failed: ${JSON.stringify(diagnostic)}`), 'checkin-geo-diagnostic')
    }

    const roundedAccuracy = geo?.accuracy ? Math.round(geo.accuracy) : null

    setState('submitting')
    try {
      const outcome = await submitTapCheckIn(
        phase,
        { lat: geo?.lat ?? null, lng: geo?.lng ?? null, accuracy: roundedAccuracy },
        geoPermissionDenied,
      )
      // Duplicate tap — friendly reassurance, not an error.
      if (outcome.kind === 'alreadyCheckedIn') { setState('already'); return }
      if (outcome.kind === 'rejected') { setError(outcome.error); setState('error'); return }
      if (outcome.kind === 'serverError') {
        // Plausibly transient (server-side) rather than a definitive
        // rejection — queue for automatic retry rather than just erroring.
        enqueueCheckIn({ phase, lat: geo?.lat ?? null, lng: geo?.lng ?? null, accuracy: roundedAccuracy, recordedAt: new Date().toISOString() })
        onQueueChange?.()
        setState('queued')
        return
      }
      setState('success')
      onSuccess(new Date().toISOString())
    } catch {
      // Thrown fetch — network genuinely down (never reached the server at
      // all). This is the only case, alongside a resolved 5xx above, that
      // should enqueue for offline retry; a parsed 4xx JSON error response
      // never reaches this catch.
      enqueueCheckIn({ phase, lat: geo?.lat ?? null, lng: geo?.lng ?? null, accuracy: roundedAccuracy, recordedAt: new Date().toISOString() })
      onQueueChange?.()
      setState('queued')
    }
  }, [phase, onSuccess, onQueueChange])

  // PhaseDayCard passes fresh onSuccess/onQueueChange closures on every
  // render (they close over its own state setters) — keep the latest in
  // refs so the flush effect below only re-runs on an actual phase change,
  // not on every unrelated parent re-render.
  const onSuccessRef = useRef(onSuccess)
  const onQueueChangeRef = useRef(onQueueChange)
  useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])
  useEffect(() => { onQueueChangeRef.current = onQueueChange }, [onQueueChange])

  // Flush this phase's queued check-in (if any) on mount and whenever the
  // browser comes back online. Scoped to THIS component's own phase only —
  // that's the phase whose CTA is currently showing, which is also the one
  // most likely to have just failed and been queued a moment ago.
  const flush = useCallback(async () => {
    if (!hasQueuedCheckInToday(phase)) return
    setState('queued')
    const result = await flushQueuedCheckIn(phase, (item: QueuedCheckIn) =>
      submitTapCheckIn(phase, { lat: item.lat, lng: item.lng, accuracy: item.accuracy }, false).then(toSubmitResult),
    )
    onQueueChangeRef.current?.()
    if (result.outcome === 'sent') {
      setState('success')
      onSuccessRef.current(new Date().toISOString())
      router.refresh()
    } else if (result.outcome === 'dropped') {
      setError(result.error)
      setState('error')
    } else if (result.outcome === 'kept') {
      setState('queued')
    } else {
      // 'none' or 'stale' — nothing (more) to show for this phase.
      setState('idle')
    }
  }, [phase, router])

  useEffect(() => {
    flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [flush])

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

  if (state === 'queued') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center" data-testid="checkin-queued">
        <CloudOff size={44} className="text-amber-500" />
        <p className="text-sm font-semibold text-amber-700">Check-in saved on this phone — will send when you&apos;re back online.</p>
        <p className="text-xs text-muted-foreground">No need to tap again — this will finish on its own.</p>
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
