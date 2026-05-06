import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/push/test
 * Authenticated staff/admin only. Returns a diagnostic report and optionally
 * fires a test push to the calling user.
 * Add ?send=1 to actually send a push to yourself.
 */
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role, name').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Staff only' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const doSend = searchParams.get('send') === '1'

  // Check env vars
  const vapidSubject    = process.env.VAPID_SUBJECT
  const vapidPublicKey  = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const nextPublicVapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  const envCheck = {
    VAPID_SUBJECT:             vapidSubject    ? '✓ set' : '✗ MISSING',
    VAPID_PUBLIC_KEY:          vapidPublicKey  ? '✓ set' : '✗ MISSING',
    VAPID_PRIVATE_KEY:         vapidPrivateKey ? '✓ set' : '✗ MISSING',
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: nextPublicVapid ? '✓ set' : '✗ MISSING',
  }

  // Count subscriptions for this user
  const { data: mySubs, error: subError } = await admin
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', user.id)

  const subCount = mySubs?.length ?? 0

  // Count all subscriptions in the system
  const { count: totalSubs } = await admin
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })

  let sendResult: unknown = 'not attempted (add ?send=1 to test)'

  if (doSend && subCount > 0) {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user.id)

    const results = await Promise.allSettled(
      (subs ?? []).map(s =>
        sendPushNotification(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          { title: 'Test notification', body: 'Push is working ✓', url: '/dashboard' }
        )
      )
    )
    sendResult = results.map(r =>
      r.status === 'fulfilled' ? '✓ sent' : `✗ ${(r as PromiseRejectedResult).reason?.message ?? 'failed'}`
    )
  } else if (doSend && subCount === 0) {
    sendResult = '✗ No subscriptions for your account — opt in first'
  }

  return NextResponse.json({
    user: profile.name,
    envVars: envCheck,
    yourSubscriptions: subCount,
    totalSubscriptionsInSystem: totalSubs ?? 0,
    subError: subError?.message ?? null,
    sendResult,
  }, { status: 200 })
}
