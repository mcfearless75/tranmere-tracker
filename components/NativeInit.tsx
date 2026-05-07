'use client'

/**
 * Mounts once in the student layout to initialise native-only features:
 *  - Background geofence watcher (Capacitor community plugin)
 *
 * On web this is a no-op — all guards live inside the imported functions.
 */

import { useEffect } from 'react'
import { initBackgroundGeofence } from '@/lib/background-geofence'

export function NativeInit() {
  useEffect(() => {
    initBackgroundGeofence().catch(() => {})
  }, [])

  return null
}
