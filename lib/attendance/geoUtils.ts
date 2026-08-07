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
}

/**
 * Is a reading inside the academy geofence?
 * Missing / non-numeric / non-finite coordinates are OUTSIDE by definition —
 * callers that require presence proof must treat "no GPS" as "not here".
 */
export function isInsideFence(
  lat: number | null | undefined,
  lng: number | null | undefined,
  centreLat: number,
  centreLng: number,
  radiusM: number
): FenceResult {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return { inside: false, distanceM: null }
  }
  const distanceM = flatEarthDistanceMetres(lat, lng, centreLat, centreLng)
  return { inside: distanceM <= radiusM, distanceM }
}
