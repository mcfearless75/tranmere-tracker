// Vercel Cron: GET /api/cron/session-reminders — runs every 5 minutes.
// Sends a push notification to all students for any session whose opens_at
// falls inside the next 5–15 minute window. Idempotent within a window
// because the cron only fires once every 5 mins.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Vercel Cron sets this header automatically; reject manual triggers
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now   = new Date()
  const today = now.toISOString().split('T')[0]

  // Window: sessions starting in 9–14 minutes from now (5-min wide so the
  // 5-minute cron catches each session exactly once)
  const windowStart = new Date(now.getTime() + 9  * 60_000).toISOString()
  const windowEnd   = new Date(now.getTime() + 14 * 60_000).toISOString()

  const { data: sessions } = await admin
    .from('attendance_sessions')
    .select('id, session_label, session_type, opens_at')
    .eq('scheduled_date', today)
    .gte('opens_at', windowStart)
    .lt('opens_at',  windowEnd)

  if (!sessions?.length) return NextResponse.json({ sent: 0, sessions: 0 })

  // Get all student push subscriptions once
  const { data: students } = await admin.from('users').select('id').eq('role', 'student')
  const studentIds = (students ?? []).map(s => s.id)
  if (!studentIds.length) return NextResponse.json({ sent: 0, sessions: sessions.length })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', studentIds)

  if (!subs?.length) return NextResponse.json({ sent: 0, sessions: sessions.length })

  let totalSent = 0
  for (const session of sessions) {
    const opens = new Date(session.opens_at)
    const minsUntil = Math.max(1, Math.round((opens.getTime() - now.getTime()) / 60_000))

    const payload = {
      title: `${session.session_label} in ${minsUntil} mins`,
      body:  `Your ${session.session_type} session starts at ${opens.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      url:   '/attendance',
    }

    const results = await Promise.allSettled(
      subs.map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
    )
    totalSent += results.filter(r => r.status === 'fulfilled').length
  }

  return NextResponse.json({ sent: totalSent, sessions: sessions.length })
}
