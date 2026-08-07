/**
 * Pure validation for academy_settings edits (admin attendance settings page
 * + app/api/attendance/settings). Windows must be well-formed, each start
 * before its end, and the three phases ordered without overlap:
 *   am_start < am_end <= lunch_start < lunch_end <= pm_start < pm_end
 */

import { toMinutes } from '@/lib/attendance/phase'

export type WindowsInput = {
  am_window_start: string
  am_window_end: string
  lunch_window_start: string
  lunch_window_end: string
  pm_window_start: string
  pm_window_end: string
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/** Returns an error message, or null when the windows are valid. */
export function validateWindows(w: WindowsInput): string | null {
  const fields: [keyof WindowsInput, string][] = [
    ['am_window_start', 'AM start'], ['am_window_end', 'AM end'],
    ['lunch_window_start', 'Lunch start'], ['lunch_window_end', 'Lunch end'],
    ['pm_window_start', 'PM start'], ['pm_window_end', 'PM end'],
  ]
  for (const [key, label] of fields) {
    if (typeof w[key] !== 'string' || !TIME_RE.test(w[key])) {
      return `${label} must be a valid time (HH:MM)`
    }
  }

  const amS = toMinutes(w.am_window_start)
  const amE = toMinutes(w.am_window_end)
  const luS = toMinutes(w.lunch_window_start)
  const luE = toMinutes(w.lunch_window_end)
  const pmS = toMinutes(w.pm_window_start)
  const pmE = toMinutes(w.pm_window_end)

  if (amS >= amE) return 'AM window must start before it ends'
  if (luS >= luE) return 'Lunch window must start before it ends'
  if (pmS >= pmE) return 'PM window must start before it ends'
  if (amE > luS)  return 'AM window must close before the lunch window opens'
  if (luE > pmS)  return 'Lunch window must close before the PM window opens'
  return null
}

/** Returns an error message, or null when geo settings are valid. */
export function validateGeo(geo: { geo_lat: number; geo_lng: number; radius_m: number }): string | null {
  const { geo_lat, geo_lng, radius_m } = geo
  if (typeof geo_lat !== 'number' || !Number.isFinite(geo_lat) || geo_lat < -90 || geo_lat > 90) {
    return 'Latitude must be between -90 and 90'
  }
  if (typeof geo_lng !== 'number' || !Number.isFinite(geo_lng) || geo_lng < -180 || geo_lng > 180) {
    return 'Longitude must be between -180 and 180'
  }
  if (!Number.isInteger(radius_m) || radius_m < 10 || radius_m > 10_000) {
    return 'Radius must be a whole number between 10 and 10,000 metres'
  }
  return null
}
