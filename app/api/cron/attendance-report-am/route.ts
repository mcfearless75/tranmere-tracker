// Vercel Cron: 10:30 weekdays — pushes AM attendance summary to all staff.
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
