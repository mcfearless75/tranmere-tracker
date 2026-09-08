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
 */
export type GeoFix = { lat: number; lng: number; accuracy: number }

export function getGeoFix(opts: {
  highAccuracyTimeoutMs?: number
  fallbackTimeoutMs?: number
} = {}): Promise<GeoFix | null> {
  const { highAccuracyTimeoutMs = 8000, fallbackTimeoutMs = 6000 } = opts

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve(null)
  }

  const request = (enableHighAccuracy: boolean, timeoutMs: number): Promise<GeoFix | null> =>
    new Promise(resolve => {
      // A little slack past the geolocation API's own `timeout` — that option
      // isn't always honoured precisely by every browser, so this backstop
      // guarantees the promise still settles.
      const timer = setTimeout(() => resolve(null), timeoutMs + 1000)
      navigator.geolocation.getCurrentPosition(
        pos => {
          clearTimeout(timer)
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        },
        () => { clearTimeout(timer); resolve(null) },
        { enableHighAccuracy, timeout: timeoutMs },
      )
    })

  return request(true, highAccuracyTimeoutMs).then(fix => fix ?? request(false, fallbackTimeoutMs))
}
