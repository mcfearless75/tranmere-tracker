import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { sendFcmBatch } from '@/lib/firebase-admin'
import { safeEqual } from '@/lib/security'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Allow automated cron/edge function calls via shared secret.
  // safeEqual is constant-time and fails closed when CRON_SECRET is unset.
  const isCronCall = safeEqual(request.headers.get('x-cron-secret'), process.env.CRON_SECRET)

  const adminClient = createAdminClient()

  if (!isCronCall) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Role check via service client (bypass RLS)
    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { title, body, targetUserIds, url } = await request.json()

  if (!title || !body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  const notification = { title, body, url: url ?? '/dashboard' }
  const hasTargets = Array.isArray(targetUserIds) && targetUserIds.length > 0

  // ── Web push (VAPID) ──────────────────────────────────────────────────────
  let webQuery = adminClient.from('push_subscriptions').select('endpoint, p256dh, auth')
  if (hasTargets) webQuery = webQuery.in('user_id', targetUserIds)

  const { data: subs, error: subError } = await webQuery
  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 })

  const webResults = await Promise.allSettled(
    (subs ?? []).map(sub => sendPushNotification(sub, notification))
  )

  const webSent = webResults.filter(r => r.status === 'fulfilled').length
  const webFailed = webResults.filter(r => r.status === 'rejected').length

  // Prune dead subscriptions: 404/410 from the push service means the browser
  // has expired or revoked the subscription — the row will never work again.
  const deadEndpoints = webResults
    .map((r, i) =>
      r.status === 'rejected' &&
      [404, 410].includes((r.reason as { statusCode?: number } | undefined)?.statusCode ?? 0)
        ? (subs ?? [])[i]?.endpoint
        : null
    )
    .filter((e): e is string => typeof e === 'string')
  if (deadEndpoints.length > 0) {
    await adminClient.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
  }

  // ── Native push (FCM via Firebase Admin) ──────────────────────────────────
  let fcmSent = 0
  let fcmFailed = 0

  let nativeQuery = adminClient.from('native_push_tokens').select('token')
  if (hasTargets) nativeQuery = nativeQuery.in('user_id', targetUserIds)

  const { data: nativeTokens } = await nativeQuery
  const tokens = (nativeTokens ?? []).map(r => r.token as string)

  if (tokens.length > 0) {
    const fcmResult = await sendFcmBatch(tokens, notification)
    fcmSent = fcmResult.sent
    fcmFailed = fcmResult.failed
  }

  return NextResponse.json({
    sent: webSent + fcmSent,
    failed: webFailed + fcmFailed,
    total: (subs?.length ?? 0) + tokens.length,
    detail: {
      web: { sent: webSent, failed: webFailed, total: subs?.length ?? 0 },
      native: { sent: fcmSent, failed: fcmFailed, total: tokens.length },
    },
  })
}
