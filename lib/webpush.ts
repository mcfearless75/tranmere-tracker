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
 * Send a push notification to all subscriptions belonging to a given user.
 * Fetches subscriptions from `push_subscriptions` using the provided admin client.
 * Silently returns if the user has no subscriptions registered.
 */
export async function sendPushNotificationToUser(
  adminClient: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  const { data: subs } = await adminClient
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  const payload: PushPayload = { title, body, url }
  await Promise.allSettled(
    subs.map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
  )
}
