import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { friendlyCheckInError } from '@/lib/attendance/checkInErrors'
import { isInsideFence } from '@/lib/attendance/geoUtils'
import { recordAndNotifyRejection } from '@/lib/attendance/rejectionNotify'
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

  const { phase, geo_lat, geo_lng, geo_accuracy_m, geo_permission_denied } = await request.json() as {
    phase: AttendancePhase
    geo_lat?: number | null
    geo_lng?: number | null
    geo_accuracy_m?: number | null
    geo_permission_denied?: boolean
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

  const today = londonDateISO()

  // Hard geofence — missing or out-of-range GPS is normally a rejection on
  // this path. Exception: the browser flatly refused location permission
  // (common in a third-party QR-scanner app's embedded in-app browser, which
  // often blocks geolocation entirely and can't be fixed from iOS Settings).
  // That student may well be physically present with no way to self-resolve
  // the block, so let the check-in through — flagged for staff review below
  // — instead of hard-rejecting with a misleading "you're not at the
  // academy" error. Genuine "couldn't get a fix" (timeout/position-
  // unavailable) still hard-rejects unchanged — that's real anti-fraud
  // signal this path relies on.
  const fence = isInsideFence(geo_lat, geo_lng, settings.geo_lat, settings.geo_lng, settings.radius_m, geo_accuracy_m)
  // The bypass is only credible when the client genuinely has NO fix. Real
  // coordinates plus geo_permission_denied:true is a contradiction — treat
  // the coordinates as authoritative and let the fence decide.
  const bypassForPermissionDenied =
    !fence.inside && geo_permission_denied === true && geo_lat == null && geo_lng == null
  if (!fence.inside && !bypassForPermissionDenied) {
    await recordAndNotifyRejection(admin, user.id, today, phase, fence.distanceM)
    return NextResponse.json({ ok: false, error: NOT_AT_ACADEMY }, { status: 422 })
  }

  // Idempotency: short-circuit before the RPC on a repeat tap
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

  // submit_daily_check_in now returns TABLE(id, won) instead of a bare uuid —
  // see supabase/migrations/052_checkin_won_flag.sql.
  const result = (Array.isArray(data) ? data[0] : data) as { id: string; won: boolean } | null

  // Permission-denied bypass: the RPC has no idea this check-in was let
  // through without GPS proof (it just saw whatever coordinates were sent,
  // if any), so flag it here for staff review — same column convention as
  // lib/attendance/manualOverride.ts's buildOverridePatch.
  //
  // Coarse fix (viaTolerance): the reading was outside the radius and only
  // passed because its reported accuracy circle reaches the academy — e.g.
  // a Wi-Fi/cell position at ±1500m. On the sticker path that's fine (the
  // tap is the proof); here the fence IS the proof, so let the student
  // through but flag it for staff review with the honest numbers. The RPC
  // applies the same tolerance and records it as clean, so set it here.
  const flagPatch = bypassForPermissionDenied
    ? {
        [`${phase}_is_flagged`]: true,
        [`${phase}_flag_reason`]: 'Location permission denied on device — check-in allowed without GPS proof',
      }
    : fence.viaTolerance
      ? {
          [`${phase}_is_flagged`]: true,
          [`${phase}_flag_reason`]: `GPS ${Math.round(fence.distanceM ?? 0)}m from academy (±${Math.round(geo_accuracy_m ?? 0)}m accuracy) — coarse fix, in-app tap`,
        }
      : null
  if (flagPatch) {
    try {
      await admin
        .from('daily_attendance')
        .update(flagPatch)
        .eq('student_id', user.id)
        .eq('attendance_date', today)
    } catch (err) {
      console.error('Failed to flag tap check-in:', err)
    }
  }

  return NextResponse.json({ ok: true, success: true, id: result?.id })
}
