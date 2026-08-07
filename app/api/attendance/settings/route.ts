// Staff-gated editor for the academy_settings singleton: check-in windows
// (am/lunch/pm), geofence centre and radius. The nfc_token is intentionally
// NOT writable here — rotating it invalidates every printed sticker.

import { requireStaff } from '@/lib/auth/requireRole'
import { validateWindows, validateGeo, type WindowsInput } from '@/lib/attendance/windowValidation'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type SettingsPayload = WindowsInput & {
  geo_lat: number
  geo_lng: number
  radius_m: number
}

export async function POST(request: Request) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  let body: Partial<SettingsPayload>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const windows: WindowsInput = {
    am_window_start: String(body.am_window_start ?? ''),
    am_window_end: String(body.am_window_end ?? ''),
    lunch_window_start: String(body.lunch_window_start ?? ''),
    lunch_window_end: String(body.lunch_window_end ?? ''),
    pm_window_start: String(body.pm_window_start ?? ''),
    pm_window_end: String(body.pm_window_end ?? ''),
  }

  const windowError = validateWindows(windows)
  if (windowError) return NextResponse.json({ error: windowError }, { status: 400 })

  const geo = {
    geo_lat: Number(body.geo_lat),
    geo_lng: Number(body.geo_lng),
    radius_m: Number(body.radius_m),
  }
  const geoError = validateGeo(geo)
  if (geoError) return NextResponse.json({ error: geoError }, { status: 400 })

  const { error } = await admin
    .from('academy_settings')
    .update({ ...windows, ...geo, updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
