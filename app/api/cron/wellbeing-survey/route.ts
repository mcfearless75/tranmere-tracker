import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { isFortnightlyWeek } from '@/lib/wellbeing/wellbeingUtils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Only fire on fortnightly (odd ISO) weeks
  if (!isFortnightlyWeek(now)) {
    return NextResponse.json({ skipped: true, reason: 'even week' })
  }

  const admin = createAdminClient()

  // Get all active students
  const { data: students, error: studentsErr } = await admin
    .from('users')
    .select('id')
    .eq('role', 'student')

  if (studentsErr || !students?.length) {
    return NextResponse.json({ error: studentsErr?.message ?? 'no students' }, { status: 500 })
  }

  // Find students who already have an open survey this week
  const weekStart = new Date(now)
  weekStart.setUTCHours(0, 0, 0, 0)
  weekStart.setUTCDate(now.getUTCDate() - (now.getUTCDay() || 7) + 1) // Monday

  const { data: existing } = await admin
    .from('wellbeing_surveys')
    .select('student_id')
    .eq('status', 'open')
    .gte('sent_at', weekStart.toISOString())

  const alreadySent = new Set((existing ?? []).map(r => r.student_id))

  const targets = students.filter(s => !alreadySent.has(s.id))

  if (!targets.length) {
    return NextResponse.json({ sent: 0, reason: 'all students already have open survey' })
  }

  // Insert survey rows
  const { error: insertErr } = await admin
    .from('wellbeing_surveys')
    .insert(targets.map(s => ({ student_id: s.id, status: 'open' })))

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Send push notifications
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', targets.map(s => s.id))

  if (subs?.length) {
    await Promise.allSettled(
      subs.map(s =>
        sendPushNotification(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          {
            title: 'Wellbeing Check-in 💙',
            body: 'Your fortnightly wellbeing survey is ready — takes 60 seconds.',
            url: '/wellbeing',
          }
        )
      )
    )
  }

  return NextResponse.json({ sent: targets.length })
}
