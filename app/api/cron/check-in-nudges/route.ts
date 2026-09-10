// Vercel Cron: nudges students who haven't checked in for the current phase.
// Runs at 08:00, 12:00 and 15:00 UTC weekdays (09:00, 13:00, 16:00 London
// during BST). Phase from London hour: <11 → am, 11–14 → lunch, else pm.

import { createAdminClient } from '@/lib/supabase/admin'
import { londonDateISO, londonHour } from '@/lib/dates'
import { notifyUsers } from '@/lib/notifications/notifyStaff'
import { verifyCronSecret } from '@/lib/security'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now   = new Date()

  // Determine phase from London local time. (new Date(toLocaleString('en-GB'))
  // is unparseable dd/mm/yyyy → getHours() was NaN → phase was always 'pm'.)
  const hour  = londonHour(now)
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
