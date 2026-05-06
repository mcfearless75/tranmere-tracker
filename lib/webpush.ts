import webpush from 'web-push'

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
