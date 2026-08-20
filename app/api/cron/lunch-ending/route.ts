// Vercel Cron: daily "lunch is nearly over" broadcast to every active student.
// Runs at 11:45 UTC weekdays = 12:45 London during BST. Scheduled as a fixed
// UTC time like the other attendance crons (see check-in-nudges) — it will
// read as 12:45 GMT, i.e. an hour early by the clock, once BST ends; adjust
// vercel.json when the clocks change if the wall-clock time matters that
// precisely outside term-time.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { sendFcmBatch } from '@/lib/firebase-admin'
import { verifyCronSecret } from '@/lib/security'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: students } = await admin.from('users').select('id').eq('role', 'student')
  if (!students?.length) return NextResponse.json({ sent: 0 })

  const studentIds = students.map(s => s.id)
  const payload = {
    title: '⏰ Lunch almost over',
    body: 'Back to lessons/training shortly — make sure you\'re checked in.',
    url: '/attendance',
  }

  // ── Web push ─────────────────────────────────────────────────────────────
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', studentIds)

  const webResults = await Promise.allSettled(
    (subs ?? []).map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
  )
  const webSent = webResults.filter(r => r.status === 'fulfilled').length

  // Prune dead subscriptions (404/410 = the browser revoked/expired it).
  const deadEndpoints = webResults
    .map((r, i) =>
      r.status === 'rejected' &&
      [404, 410].includes((r.reason as { statusCode?: number } | undefined)?.statusCode ?? 0)
        ? (subs ?? [])[i]?.endpoint
        : null
    )
    .filter((e): e is string => typeof e === 'string')
  if (deadEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
  }

  // ── Native push (FCM) ───────────────────────────────────────────────────
  const { data: nativeTokens } = await admin
    .from('native_push_tokens')
    .select('token')
    .in('user_id', studentIds)

  const fcmResult = await sendFcmBatch((nativeTokens ?? []).map(r => r.token as string), payload)

  return NextResponse.json({
    sent: webSent + fcmResult.sent,
    detail: {
      web: { sent: webSent, total: subs?.length ?? 0 },
      native: fcmResult,
    },
  })
}
