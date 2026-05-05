// Vercel Cron: 17:30 weekdays — pushes PM checkout summary to all staff.
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: students }, { data: records }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student'),
    admin.from('daily_attendance').select('student_id, pm_checked_at').eq('attendance_date', today),
  ])

  const studentList = students ?? []
  const checkedOut  = new Set((records ?? []).filter(r => r.pm_checked_at).map(r => r.student_id))
  const stillIn     = studentList.filter(s => !checkedOut.has(s.id))

  const { data: staff } = await admin.from('users').select('id').in('role', ['admin', 'coach', 'teacher'])
  const staffIds = (staff ?? []).map(s => s.id)
  if (!staffIds.length) return NextResponse.json({ sent: 0 })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', staffIds)

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const body = stillIn.length === 0
    ? `All ${studentList.length} students checked out ✓`
    : `${stillIn.length} not checked out: ${stillIn.slice(0, 3).map(s => s.name.split(' ')[0]).join(', ')}${stillIn.length > 3 ? ` +${stillIn.length - 3} more` : ''}`

  const payload = {
    title: `End of day — ${checkedOut.size}/${studentList.length} out`,
    body,
    url:   '/admin/attendance',
  }

  const results = await Promise.allSettled(
    subs.map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
  )
  const sent = results.filter(r => r.status === 'fulfilled').length

  return NextResponse.json({
    sent,
    total: studentList.length,
    out: checkedOut.size,
    still_in: stillIn.length,
  })
}
