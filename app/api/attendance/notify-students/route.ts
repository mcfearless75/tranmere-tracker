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
    .select('id, session_label, session_type')
    .eq('id', sessionId)
    .single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Get all student push subscriptions
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in(
      'user_id',
      (
        await admin
          .from('users')
          .select('id')
          .eq('role', 'student')
      ).data?.map(u => u.id) ?? []
    )

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const payload = {
    title: `Check in — ${session.session_label}`,
    body:  'Your session is now open. Tap to check in.',
    url:   `/attendance?session=${session.id}`,
  }

  const results = await Promise.allSettled(
    subs.map(sub => sendPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload))
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ sent, failed })
}
