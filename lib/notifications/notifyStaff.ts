import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/webpush'
import { sendFcmBatch } from '@/lib/firebase-admin'

export type StaffNotification = { title: string; body: string; url: string }

/**
 * Dual-channel (web push + native/FCM) notification to an explicit list of
 * user ids. Extracted from the pattern already independently implemented in
 * app/api/push/send/route.ts, notifyRoomMembers, and nudgeRoom
 * (app/chat/actions.ts) — those three existing call sites are not touched
 * by this change; this helper is for new/refactored call sites going
 * forward. Best-effort: never throws, matching every other safeguarding
 * notification in this app.
 */
export async function notifyUsers(
  admin: SupabaseClient,
  userIds: string[],
  notification: StaffNotification,
): Promise<void> {
  if (userIds.length === 0) return

  try {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (subs?.length) {
      await Promise.allSettled(
        subs.map(s =>
          sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, notification)
        )
      )
    }

    const { data: nativeTokens } = await admin
      .from('native_push_tokens')
      .select('token')
      .in('user_id', userIds)

    const tokens = (nativeTokens ?? []).map(r => r.token as string)
    if (tokens.length > 0) {
      await sendFcmBatch(tokens, notification)
    }
  } catch (err) {
    console.error('[notifyUsers] failed:', err)
  }
}
