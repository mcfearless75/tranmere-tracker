import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyParentsOfCheckIn } from '@/lib/attendance/parentNotifyUtils'
import { isInsideFence } from '@/lib/attendance/geoUtils'
import type { AttendancePhase } from '@/lib/attendance/phase'
import { londonDateISO } from '@/lib/dates'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PHASES: readonly AttendancePhase[] = ['am', 'lunch', 'pm']

/**
 * Geofenced auto check-in (background watcher path). Hard geofence: the
 * academy location and radius come from academy_settings — NOT env vars.
 * (The old NEXT_PUBLIC_GROUND_* fallbacks pointed ~2.8km from the academy
 * and would have 422'd every genuine on-site check-in.)
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json() as { period: string; lat: number; lng: number; accuracy?: number }
  const { period, lat, lng } = body

  if (!period || !PHASES.includes(period as AttendancePhase) || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const phase = period as AttendancePhase

  const admin = createAdminClient()

  // Authoritative geofence from settings — client check is UX only
  const { data: settings } = await admin
    .from('academy_settings')
    .select('geo_lat, geo_lng, radius_m')
    .eq('id', 1)
    .maybeSingle()

  if (!settings) {
    return NextResponse.json({ error: 'Academy not configured' }, { status: 500 })
  }

  const fence = isInsideFence(lat, lng, settings.geo_lat, settings.geo_lng, settings.radius_m)
  if (!fence.inside) {
    const dist = fence.distanceM === null ? '' : ` (${Math.round(fence.distanceM)}m)`
    return NextResponse.json({ error: `Too far from the academy${dist}` }, { status: 422 })
  }

  const today = londonDateISO()
  const now = new Date().toISOString()

  const column = `${phase}_checked_at` as const

  // Upsert daily_attendance row — don't overwrite if already checked in
  const { data: existing } = await admin
    .from('daily_attendance')
    .select('id, am_checked_at, lunch_checked_at, pm_checked_at')
    .eq('student_id', user.id)
    .eq('attendance_date', today)
    .maybeSingle()

  if (existing && existing[column as keyof typeof existing]) {
    // Already checked in — return success idempotently, no duplicate push
    return NextResponse.json({ ok: true, already: true })
  }

  if (existing) {
    await admin
      .from('daily_attendance')
      .update({ [column]: now })
      .eq('id', existing.id)
  } else {
    await admin
      .from('daily_attendance')
      .insert({ student_id: user.id, attendance_date: today, [column]: now })
  }

  // Awaited so serverless doesn't kill the push mid-flight; never throws.
  await notifyParentsOfCheckIn(admin, user.id, phase, 'checked_in')

  return NextResponse.json({ ok: true })
}
