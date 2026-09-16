// Vercel Cron: 10:30 weekdays — pushes AM attendance summary to all staff.
//
// Vercel cron schedules are fixed UTC — there is no DST-aware option. The UK's
// offset from UTC is always a whole number of hours, so the MINUTE never
// shifts — only the hour does. vercel.json fires this route twice, at 9:30
// and 10:30 UTC (one covers BST, the other GMT); this handler checks the
// real London hour via Intl and only sends when it's actually 10, so exactly
// one of the two invocations does anything on any given day — self-
// correcting across the clock change with no manual schedule edit. Same
// pattern as lunch-ending and calendar-reminders.
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

  const now = new Date()
  if (londonHour(now) !== 10) {
    return NextResponse.json({ skipped: true, reason: 'not 10:30 London time', londonHour: londonHour(now) })
  }

  const admin = createAdminClient()
  // London calendar date — the raw UTC date is wrong for late-evening runs
  // and inconsistent with the check-in rows, which key on London dates.
  const today = londonDateISO()

  const [{ data: students }, { data: records }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student').eq('is_active', true),
    admin.from('daily_attendance').select('student_id, am_checked_at').eq('attendance_date', today),
  ])

  const studentList = students ?? []
  const checkedIds  = new Set((records ?? []).filter(r => r.am_checked_at).map(r => r.student_id))
  const missing     = studentList.filter(s => !checkedIds.has(s.id))

  // Get staff push subscriptions
  const { data: staff } = await admin.from('users').select('id').in('role', ['admin', 'coach', 'teacher'])
  const staffIds = (staff ?? []).map(s => s.id)
  if (!staffIds.length) return NextResponse.json({ sent: 0 })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', staffIds)

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const headlines = missing.length === 0
    ? `All ${studentList.length} students checked in ✓`
    : `${missing.length} not in: ${missing.slice(0, 3).map(s => s.name.split(' ')[0]).join(', ')}${missing.length > 3 ? ` +${missing.length - 3} more` : ''}`

  const payload = {
    title: `Morning attendance — ${checkedIds.size}/${studentList.length}`,
    body:  headlines,
    url:   '/admin/attendance',
  }

  const results = await Promise.allSettled(
    subs.map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
  )
  const sent = results.filter(r => r.status === 'fulfilled').length

  return NextResponse.json({
    sent,
    total: studentList.length,
    in: checkedIds.size,
    missing: missing.length,
  })
}
