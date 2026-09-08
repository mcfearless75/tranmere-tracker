/**
 * Best-effort browser GPS fix with a fast low-accuracy fallback.
 *
 * Both check-in flows (AutoCheckIn, InAppCheckIn) only ever asked for
 * `enableHighAccuracy: true` — a real GPS satellite fix, which needs a clear
 * sky view and can take 15-30+s indoors or with a cold chip (first fix after
 * the device has been idle overnight). That's exactly the AM check-in
 * conditions: first tap of the day, indoors near reception. Confirmed live
 * 2026-09-08: 100% of that morning's AM check-ins (4/4) were flagged "No GPS
 * provided" despite the timeout already having been extended once before
 * (5-6s -> 12-13s, 2026-09-07) — the extension helped (72% -> still high) but
 * didn't fix the underlying cause, because more time doesn't help if the GPS
 * chip physically can't get a satellite lock indoors at all.
 *
 * Network/WiFi-based positioning (`enableHighAccuracy: false`) resolves in a
 * few seconds almost anywhere indoors, at lower precision — plenty good
 * enough for a ~250m geofence radius. For an audit-only flag (AutoCheckIn
 * never blocks the check-in either way) or even for the hard-reject path
 * (InAppCheckIn), a fast low-accuracy fix beats a highly-precise null.
 *
 * Sequential, not parallel: try high accuracy first (best case: precise and
 * still reasonably fast outdoors), then only spend the fallback budget if
 * that didn't produce anything.
 *
 * 2026-09-08 same-day follow-up: this genuinely helped (flag rate dropped
 * from 72-100% pre-fix to ~54% in the first ~70 post-deploy check-ins) but
 * didn't fully solve it. daily_attendance only ever stored "got coordinates
 * or didn't" — permission-denied and still-timed-out look identical in that
 * column, and they need opposite fixes (denied needs a permission-request
 * UX nudge; timeout needs a longer budget). `onDiagnostic` reports which
 * actually happened, per attempt, so the next batch of real data can tell
 * the two apart instead of guessing again.
 */
export type GeoFix = { lat: number; lng: number; accuracy: number }

export type GeoAttemptOutcome = 'success' | 'permission-denied' | 'position-unavailable' | 'timeout'

export type GeoDiagnostic = {
  highAccuracy: GeoAttemptOutcome | 'unsupported'
  lowAccuracy?: GeoAttemptOutcome
}

function codeToOutcome(code: number): GeoAttemptOutcome {
  if (code === 1) return 'permission-denied' // GeolocationPositionError.PERMISSION_DENIED
  if (code === 2) return 'position-unavailable' // .POSITION_UNAVAILABLE
  return 'timeout' // .TIMEOUT, or anything unrecognised
}

export function getGeoFix(opts: {
  highAccuracyTimeoutMs?: number
  fallbackTimeoutMs?: number
  onDiagnostic?: (diagnostic: GeoDiagnostic) => void
} = {}): Promise<GeoFix | null> {
  const { highAccuracyTimeoutMs = 8000, fallbackTimeoutMs = 6000, onDiagnostic } = opts

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    onDiagnostic?.({ highAccuracy: 'unsupported' })
    return Promise.resolve(null)
  }

  const diagnostic: GeoDiagnostic = { highAccuracy: 'timeout' }

  const request = (
    enableHighAccuracy: boolean,
    timeoutMs: number,
    key: 'highAccuracy' | 'lowAccuracy',
  ): Promise<GeoFix | null> =>
    new Promise(resolve => {
      let settled = false
      // A little slack past the geolocation API's own `timeout` — that option
      // isn't always honoured precisely by every browser, so this backstop
      // guarantees the promise still settles.
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        diagnostic[key] = 'timeout'
        resolve(null)
      }, timeoutMs + 1000)
      navigator.geolocation.getCurrentPosition(
        pos => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          diagnostic[key] = 'success'
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        },
        err => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          diagnostic[key] = codeToOutcome(err?.code)
          resolve(null)
        },
        { enableHighAccuracy, timeout: timeoutMs },
      )
    })

  return request(true, highAccuracyTimeoutMs, 'highAccuracy').then(fix => {
    if (fix) { onDiagnostic?.(diagnostic); return fix }
    return request(false, fallbackTimeoutMs, 'lowAccuracy').then(fallbackFix => {
      onDiagnostic?.(diagnostic)
      return fallbackFix
    })
  })
}
