import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyParentsOfCheckIn } from '@/lib/attendance/parentNotifyUtils'
import { notifyStaffOfFlaggedCheckIn } from '@/lib/attendance/staffFlagNotify'
import { friendlyCheckInError } from '@/lib/attendance/checkInErrors'
import type { AttendancePhase } from '@/lib/attendance/phase'
import { londonDateISO } from '@/lib/dates'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PHASES: readonly AttendancePhase[] = ['am', 'lunch', 'pm']

/**
 * NFC sticker check-in. The sticker at reception encodes the academy
 * nfc_token; a tap opens this route via the student attendance page.
 * The physical tap is the presence proof — geo is recorded as evidence and
 * flag-only (the RPC flags outside-radius and missing GPS, never rejects).
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 })

  const {
    phase,
    nfc_token,
    geo_lat,
    geo_lng,
    geo_accuracy_m,
    selfie_path,
    geo_permission_denied,
  } = await request.json() as {
    phase: AttendancePhase
    nfc_token: string
    geo_lat?: number | null
    geo_lng?: number | null
    geo_accuracy_m?: number | null
    selfie_path?: string | null
    geo_permission_denied?: boolean
  }

  if (!PHASES.includes(phase)) {
    return NextResponse.json({ ok: false, error: 'Invalid phase' }, { status: 400 })
  }
  if (!nfc_token) {
    return NextResponse.json({ ok: false, error: 'Missing check-in token — tap the NFC sticker' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Idempotency: if this phase is already recorded today, short-circuit BEFORE
  // the RPC so a double-tap can never re-fire the parent push (first-tap-wins
  // in the RPC protects the data; this protects the notifications).
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
    p_phase:           phase,
    p_nfc_token:       nfc_token,
    p_geo_lat:         geo_lat ?? null,
    p_geo_lng:         geo_lng ?? null,
    p_geo_accuracy_m:  geo_accuracy_m ?? null,
    p_selfie_path:     selfie_path ?? null,
    p_client_ip:       clientIp,
  })

  if (error) {
    // Never surface raw Postgres text to students
    const friendly = friendlyCheckInError(error.message)
    return NextResponse.json({ ok: false, error: friendly.message }, { status: friendly.status })
  }

  // submit_daily_check_in is first-tap-wins at the DATA level, but a racing
  // duplicate call (e.g. the NFC App Link double-dispatching and opening this
  // page twice for one physical tap) still gets a success reply. `won` says
  // whether THIS call is the one that actually wrote the row — only that call
  // may fire notifications, or a race produces duplicate parent/staff pushes
  // for what was a single check-in.
  const result = (Array.isArray(data) ? data[0] : data) as { id: string; won: boolean } | null
  const won = result?.won === true

  if (won) {
    // Awaited so serverless doesn't kill the push mid-flight; never throws.
    await notifyParentsOfCheckIn(admin, user.id, phase, 'checked_in')

    // The RPC only ever sees "no coordinates" and flags it generically as
    // "No GPS provided" — which reads like a truancy signal. If the client
    // told us the browser flatly refused location (common in a third-party
    // QR-scanner app's in-app browser — confirmed 2026-09-10 as the cause of
    // nearly every remaining flag on this path), relabel it so staff see the
    // real reason. Same convention as tap-checkin/route.ts's
    // bypassForPermissionDenied.
    if (geo_permission_denied) {
      try {
        await admin
          .from('daily_attendance')
          .update({ [`${phase}_flag_reason`]: 'Location permission denied on device — check-in allowed without GPS proof' })
          .eq('student_id', user.id)
          .eq('attendance_date', today)
          .eq(`${phase}_is_flagged`, true)
      } catch (err) {
        console.error('Failed to relabel permission-denied flag reason:', err)
      }
    }

    // If the RPC flagged this tap (off-site GPS / no GPS), alert staff so an
    // off-track check-in surfaces immediately instead of waiting to be spotted
    // in the day view. Awaited; helper never throws.
    const { data: flagRow } = await admin
      .from('daily_attendance')
      .select(`${phase}_is_flagged, ${phase}_flag_reason`)
      .eq('student_id', user.id)
      .eq('attendance_date', today)
      .maybeSingle()
    const flagged = (flagRow as Record<string, unknown> | null)?.[`${phase}_is_flagged`] === true
    if (flagged) {
      const reason = String((flagRow as Record<string, unknown>)?.[`${phase}_flag_reason`] ?? 'flagged')
      await notifyStaffOfFlaggedCheckIn(admin, user.id, phase, reason)
    }
  }

  return NextResponse.json({ ok: true, success: true, id: result?.id })
}
