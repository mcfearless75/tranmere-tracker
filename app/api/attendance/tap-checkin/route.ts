import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { friendlyCheckInError } from '@/lib/attendance/checkInErrors'
import { isInsideFence } from '@/lib/attendance/geoUtils'
import type { AttendancePhase } from '@/lib/attendance/phase'
import { londonDateISO } from '@/lib/dates'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PHASES: readonly AttendancePhase[] = ['am', 'lunch', 'pm']

const NOT_AT_ACADEMY =
  'You need to be at the academy to check in from the app — or tap the sticker at reception.'

/**
 * Tap-to-check-in — the in-app button, no NFC/QR scan involved.
 *
 * Unlike the sticker path (which proves physical presence), this path has no
 * physical evidence, so the geofence is ENFORCED here: GPS coordinates are
 * required and must fall inside academy_settings.radius_m, otherwise 422.
 * The server looks up the academy NFC token internally and submits on behalf
 * of the authenticated student.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 })

  const { phase, geo_lat, geo_lng, geo_accuracy_m } = await request.json() as {
    phase: AttendancePhase
    geo_lat?: number | null
    geo_lng?: number | null
    geo_accuracy_m?: number | null
  }

  if (!PHASES.includes(phase)) {
    return NextResponse.json({ ok: false, error: 'Invalid phase' }, { status: 400 })
  }

  // Settings (token + geofence) come from the DB, server-side only
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('academy_settings')
    .select('nfc_token, geo_lat, geo_lng, radius_m')
    .eq('id', 1)
    .maybeSingle()

  if (!settings?.nfc_token) {
    return NextResponse.json({ ok: false, error: 'Academy not configured' }, { status: 500 })
  }

  // Hard geofence — missing or out-of-range GPS is a rejection on this path
  const fence = isInsideFence(geo_lat, geo_lng, settings.geo_lat, settings.geo_lng, settings.radius_m)
  if (!fence.inside) {
    return NextResponse.json({ ok: false, error: NOT_AT_ACADEMY }, { status: 422 })
  }

  // Idempotency: short-circuit before the RPC on a repeat tap
  const today = londonDateISO()
  const checkedCol = `${phase}_checked_at` as const
  const { data: existing } = await admin
    .from('daily_attendance')
    .select('am_checked_at, lunch_checked_at, pm_checked_at')
    .eq('student_id', user.id)
    .eq('attendance_date', today)
    .maybeSingle()

  if (existing?.[checkedCol]) {
    return NextResponse.json({ ok: true, success: true, alreadyCheckedIn: true })
  }

  const xff = request.headers.get('x-forwarded-for')
  const clientIp = xff?.split(',')[0]?.trim() ?? null

  const { data, error } = await supabase.rpc('submit_daily_check_in', {
    p_phase:          phase,
    p_nfc_token:      settings.nfc_token,
    p_geo_lat:        geo_lat ?? null,
    p_geo_lng:        geo_lng ?? null,
    p_geo_accuracy_m: geo_accuracy_m ?? null,
    p_selfie_path:    null,
    p_client_ip:      clientIp,
  })

  if (error) {
    const friendly = friendlyCheckInError(error.message)
    return NextResponse.json({ ok: false, error: friendly.message }, { status: friendly.status })
  }

  return NextResponse.json({ ok: true, success: true, id: data })
}
