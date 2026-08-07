/**
 * Background geofence watcher for native (Capacitor) builds.
 *
 * Call `initBackgroundGeofence()` once on app open from a client layout.
 * On web this is a complete no-op — all guards are in-function.
 *
 * Uses @capacitor-community/background-geolocation which is a native-only
 * plugin. We register it via Capacitor's registerPlugin bridge pattern.
 */

import { isNative } from '@/lib/native'
import { londonMinutes, fallbackPartitionPhase, type AttendancePhase } from '@/lib/attendance/phase'
import type { Location, BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation'

// Fallback coordinates match the academy_settings seed (53.4209, -3.0867, 250m).
const GROUND_LAT = parseFloat(process.env.NEXT_PUBLIC_GROUND_LAT  ?? '53.4209')
const GROUND_LNG = parseFloat(process.env.NEXT_PUBLIC_GROUND_LNG  ?? '-3.0867')
const RADIUS_M   = parseInt(process.env.NEXT_PUBLIC_GROUND_RADIUS_M ?? '250', 10)

/**
 * Determine which period (am/lunch/pm) is active right now in Europe/London,
 * or null outside working hours. Uses the coarse partitioned fallback windows
 * (am before 11:00, lunch 11:00–14:30, pm after 14:30, bounded 07:00–18:00) —
 * true settings-driven windows would need a fetch of academy_settings here.
 * The server enforces the real windows and idempotency regardless.
 */
function currentPeriod(): AttendancePhase | null {
  return fallbackPartitionPhase(londonMinutes())
}

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function initBackgroundGeofence(): Promise<void> {
  if (!isNative()) return

  try {
    // registerPlugin creates the JS proxy to the native bridge — the plugin
    // has no JS bundle, it lives entirely in native code.
    const { registerPlugin } = await import('@capacitor/core')
    const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
      'BackgroundGeolocation',
    )

    await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'Tranmere Tracker is checking your training ground location.',
        backgroundTitle: 'Attendance Check',
        requestPermissions: true,
        stale: false,
        distanceFilter: 30,
      },
      (location?: Location, error?: Error) => {
        if (error || !location) return

        const dist = haversineMetres(
          location.latitude, location.longitude,
          GROUND_LAT, GROUND_LNG,
        )

        if (dist > RADIUS_M) return

        const period = currentPeriod()
        if (!period) return

        // Fire-and-forget — server handles idempotency
        fetch('/api/attendance/geo-checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            period,
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy,
          }),
        }).catch(() => { /* silent — retry on next location update */ })
      },
    )
  } catch {
    // Plugin unavailable or permissions denied — silent fail
  }
}
