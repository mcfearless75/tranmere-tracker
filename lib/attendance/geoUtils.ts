/**
 * Pure geofence maths shared by the attendance API routes.
 *
 * Deliberately mirrors the flat-earth distance in the submit_daily_check_in
 * RPC (supabase/migrations/040_lunch_phase.sql) so the server routes and the
 * database agree about who is "at the academy". Flat-earth is fine at <1km
 * scales — the error vs haversine is centimetres at a 250m radius.
 */

/** Metres per degree of latitude (WGS-84 mean). */
const METRES_PER_DEG_LAT = 111320

/**
 * Flat-earth distance in metres from a reading to the academy centre.
 * The longitude correction uses the CENTRE latitude, exactly as the RPC does.
 */
export function flatEarthDistanceMetres(
  lat: number,
  lng: number,
  centreLat: number,
  centreLng: number
): number {
  return (
    METRES_PER_DEG_LAT *
    Math.sqrt(
      (lat - centreLat) ** 2 +
        ((lng - centreLng) * Math.cos((centreLat * Math.PI) / 180)) ** 2
    )
  )
}

export type FenceResult = {
  inside: boolean
  /** Distance in metres, or null when no usable coordinates were supplied. */
  distanceM: number | null
  /**
   * True when the raw distance is outside the radius and the reading only
   * counts as inside because its reported accuracy circle reaches the
   * academy. Callers whose ONLY presence proof is the fence should flag
   * (not reject) these for staff review.
   */
  viaTolerance: boolean
}

/**
 * Is a reading inside the academy geofence?
 * Missing / non-numeric / non-finite coordinates are OUTSIDE by definition —
 * callers that require presence proof must treat "no GPS" as "not here".
 *
 * `accuracyM` (the browser's reported 68% error radius) is subtracted from
 * the distance before comparing. Since fbc69b7 (2026-09-08) getGeoFix falls
 * back to network/Wi-Fi positioning indoors, which routinely reports the
 * position of the Wi-Fi provider's registered address with a 500-3000m
 * error radius — confirmed live: seven students rejected at exactly 3319m
 * on 2026-09-07 PM and two at exactly 1622m on 2026-09-08 lunch, identical
 * coordinates each time, i.e. one access-point lookup, not seven phones
 * 3.3km away. A coarse fix whose error circle covers the academy is
 * consistent with being here and must not hard-reject. This adds no new
 * spoofing vector: a client that can fake `accuracy` can fake `lat`/`lng`
 * just as easily. Mirrored in the submit_daily_check_in RPC
 * (supabase/migrations/066_accuracy_aware_geofence.sql).
 */
export function isInsideFence(
  lat: number | null | undefined,
  lng: number | null | undefined,
  centreLat: number,
  centreLng: number,
  radiusM: number,
  accuracyM?: number | null
): FenceResult {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return { inside: false, distanceM: null, viaTolerance: false }
  }
  const distanceM = flatEarthDistanceMetres(lat, lng, centreLat, centreLng)
  const tolerance =
    typeof accuracyM === 'number' && Number.isFinite(accuracyM) && accuracyM > 0 ? accuracyM : 0
  const rawInside = distanceM <= radiusM
  const inside = rawInside || Math.max(distanceM - tolerance, 0) <= radiusM
  return { inside, distanceM, viaTolerance: inside && !rawInside }
}
