import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PushPayload = {
  title: string
  body: string
  url?: string
}

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
) {
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!subject || !publicKey || !privateKey) {
    console.error('[webpush] Missing VAPID env vars:', {
      VAPID_SUBJECT: !!subject,
      VAPID_PUBLIC_KEY: !!publicKey,
      VAPID_PRIVATE_KEY: !!privateKey,
    })
    throw new Error('VAPID env vars not configured')
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload)
  )
}

/**
 * Send a push notification to every device a user has registered — web-push
 * subscriptions (`push_subscriptions`) AND native app tokens
 * (`native_push_tokens`, delivered via FCM/APNs).
 *
 * The native channel was missing here until 2026-09-10. This helper backs
 * every staff alert that matters most — missed-check-in sweeps, safeguarding
 * nudges and case-raising, GPS rejections, flagged check-ins, AM/PM digests,
 * parent check-in notices — so a coach using the iOS/Android app with
 * notifications fully enabled received none of them. Both channels run
 * independently: a failure on one never suppresses the other.
 */
export async function sendPushNotificationToUser(
  adminClient: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  const payload: PushPayload = { title, body, url }

  // Web-push channel
  try {
    const { data: subs } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (subs?.length) {
      const results = await Promise.allSettled(
        subs.map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
      )

      // Prune dead subscriptions: 404/410 means the push service no longer knows
      // this endpoint (expired/revoked) — the row will never deliver again.
      const deadEndpoints = results
        .map((r, i) =>
          r.status === 'rejected' &&
          [404, 410].includes((r.reason as { statusCode?: number } | undefined)?.statusCode ?? 0)
            ? subs[i]?.endpoint
            : null
        )
        .filter((e): e is string => typeof e === 'string')
      if (deadEndpoints.length > 0) {
        await adminClient.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
      }
    }
  } catch (err) {
    console.error('[webpush] web-push channel failed:', err)
  }

  // Native/FCM channel. Imported lazily so the many routes and tests that
  // pull in this module never initialise firebase-admin unless a native
  // token actually exists for the recipient.
  try {
    const { data: nativeTokens } = await adminClient
      .from('native_push_tokens')
      .select('token')
      .eq('user_id', userId)

    const tokens = (nativeTokens ?? [])
      .map(r => (r as { token?: unknown }).token)
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
    if (tokens.length > 0) {
      const { sendFcmBatch } = await import('@/lib/firebase-admin')
      await sendFcmBatch(tokens, payload)
    }
  } catch (err) {
    console.error('[webpush] native/FCM channel failed:', err)
  }
}
