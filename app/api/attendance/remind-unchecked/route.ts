import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Staff only
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sessionId } = await request.json() as { sessionId: string }

  // Get session details
  const { data: session } = await admin
    .from('attendance_sessions')
    .select('id, session_label')
    .eq('id', sessionId)
    .single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Students who have already checked in for this session
  const { data: records } = await admin
    .from('attendance_records')
    .select('student_id')
    .eq('session_id', sessionId)
  const checkedInIds = new Set((records ?? []).map(r => r.student_id))

  // All student IDs
  const { data: allStudents } = await admin
    .from('users')
    .select('id')
    .eq('role', 'student')
  const uncheckedIds = (allStudents ?? []).map(s => s.id).filter(id => !checkedInIds.has(id))

  if (!uncheckedIds.length) return NextResponse.json({ sent: 0, message: 'All students already checked in' })

  // Push subscriptions for unchecked students only
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', uncheckedIds)

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const payload = {
    title: `Reminder — ${session.session_label}`,
    body:  'You haven\'t checked in yet. Tap to register your attendance now.',
    url:   `/attendance?session=${session.id}`,
  }

  const results = await Promise.allSettled(
    subs.map(sub => sendPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload))
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ sent, failed })
}
