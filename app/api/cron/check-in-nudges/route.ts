// Vercel Cron: nudges students who haven't checked in for AM (or PM).
// Runs at 09:00 and 16:00 daily. Uses the academy_settings windows so the
// "you missed AM" reminder fires after the window opens but before it closes.

import { createAdminClient } from '@/lib/supabase/admin'
import { londonDateISO, londonHour } from '@/lib/dates'
import { sendPushNotification } from '@/lib/webpush'
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
  const phase: 'am' | 'pm' = hour < 12 ? 'am' : 'pm'

  const today = londonDateISO(now)

  // Get all students
  const { data: students } = await admin.from('users').select('id, name').eq('role', 'student')
  if (!students?.length) return NextResponse.json({ sent: 0 })

  // Get today's daily_attendance rows
  const { data: rows } = await admin
    .from('daily_attendance')
    .select('student_id, am_checked_at, pm_checked_at')
    .eq('attendance_date', today)

  const checkedField = phase === 'am' ? 'am_checked_at' : 'pm_checked_at'
  const checkedIds = new Set(
    (rows ?? [])
      .filter(r => r[checkedField as keyof typeof r] !== null)
      .map(r => r.student_id)
  )

  const uncheckedIds = students.filter(s => !checkedIds.has(s.id)).map(s => s.id)
  if (!uncheckedIds.length) return NextResponse.json({ sent: 0, phase })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', uncheckedIds)

  if (!subs?.length) return NextResponse.json({ sent: 0, phase })

  const payload = phase === 'am'
    ? { title: 'Morning check-in',   body: 'Tap the NFC sticker at reception when you arrive.', url: '/attendance' }
    : { title: 'End-of-day check-in', body: 'Don\'t forget to tap out before you leave.',         url: '/attendance' }

  const results = await Promise.allSettled(
    subs.map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
  )
  const sent = results.filter(r => r.status === 'fulfilled').length

  return NextResponse.json({ sent, phase, unchecked: uncheckedIds.length })
}
