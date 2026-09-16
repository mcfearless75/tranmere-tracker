// Vercel Cron: nudges students who haven't checked in for the current phase.
// Intended London times: 09:00, 13:00, 16:00 weekdays.
//
// Vercel cron schedules are fixed UTC — there is no DST-aware option. The UK's
// offset from UTC is always a whole number of hours, so the MINUTE never
// shifts — only the hour does. vercel.json fires this route SIX times
// weekdays — 08:00/12:00/15:00 UTC (BST) and 09:00/13:00/16:00 UTC (GMT) —
// one trio covers each side of the clock change. Without an exact-hour
// guard here, both trios would actually run year-round (phase was derived
// purely from a London-hour RANGE, not the intended exact time), so during
// BST the GMT-side entries would ALSO fire — same phase, an hour later,
// producing a redundant second nudge every day, not just a DST-week bug.
// This guard makes exactly one of the two invocations per intended time do
// anything, same self-correcting pattern as lunch-ending/calendar-reminders.

import { createAdminClient } from '@/lib/supabase/admin'
import { londonDateISO, londonHour } from '@/lib/dates'
import { notifyUsers } from '@/lib/notifications/notifyStaff'
import { verifyCronSecret } from '@/lib/security'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const INTENDED_HOURS = [9, 13, 16]

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now   = new Date()
  const hour  = londonHour(now)

  if (!INTENDED_HOURS.includes(hour)) {
    return NextResponse.json({ skipped: true, reason: 'not an intended London hour', londonHour: hour })
  }

  // Determine phase from London local time. (new Date(toLocaleString('en-GB'))
  // is unparseable dd/mm/yyyy → getHours() was NaN → phase was always 'pm'.)
  const phase: 'am' | 'lunch' | 'pm' = hour < 11 ? 'am' : hour <= 14 ? 'lunch' : 'pm'

  const today = londonDateISO(now)

  // Get all students
  const { data: students } = await admin.from('users').select('id, name').eq('role', 'student').eq('is_active', true)
  if (!students?.length) return NextResponse.json({ sent: 0 })

  // Get today's daily_attendance rows
  const { data: rows } = await admin
    .from('daily_attendance')
    .select('student_id, am_checked_at, lunch_checked_at, pm_checked_at')
    .eq('attendance_date', today)

  const checkedField = `${phase}_checked_at` as 'am_checked_at' | 'lunch_checked_at' | 'pm_checked_at'
  const checkedIds = new Set(
    (rows ?? [])
      .filter(r => r[checkedField] !== null)
      .map(r => r.student_id)
  )

  const uncheckedIds = students.filter(s => !checkedIds.has(s.id)).map(s => s.id)
  if (!uncheckedIds.length) return NextResponse.json({ sent: 0, phase })

  const payload = phase === 'am'
    ? { title: 'Morning check-in',    body: 'Tap the NFC sticker at reception when you arrive.',   url: '/attendance' }
    : phase === 'lunch'
    ? { title: 'Lunch check-in',      body: 'Tap the NFC sticker at reception during lunch.',      url: '/attendance' }
    : { title: 'End-of-day check-in', body: 'Don\'t forget to tap out before you leave.',          url: '/attendance' }

  // Dual-channel (web push + native/FCM) — a native app user got zero
  // check-in reminders under the old web-push-only sendPushNotification
  // loop, regardless of their notification permission. Confirmed live
  // 2026-09-10, same gap already fixed for wellbeing/chat that night.
  await notifyUsers(admin, uncheckedIds, payload)

  return NextResponse.json({ sent: uncheckedIds.length, phase })
}
