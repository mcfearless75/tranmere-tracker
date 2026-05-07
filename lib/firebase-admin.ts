/**
 * Firebase Admin SDK — lazy initialisation.
 *
 * Returns null gracefully when FIREBASE_SERVICE_ACCOUNT is not set so the
 * rest of the app works before Firebase is configured.
 *
 * FIREBASE_SERVICE_ACCOUNT must be the full JSON string of the service account
 * key file downloaded from Firebase Console → Project Settings → Service Accounts.
 */

import type { App } from 'firebase-admin/app'

let _app: App | null = null
let _initialised = false

function getApp(): App | null {
  if (_initialised) return _app
  _initialised = true

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null

  try {
    const { initializeApp, getApps, cert } = require('firebase-admin/app')
    // Avoid re-initialising if already done (e.g. hot-reload in dev)
    if (getApps().length > 0) {
      _app = getApps()[0]
      return _app
    }
    const serviceAccount = JSON.parse(raw)
    _app = initializeApp({ credential: cert(serviceAccount) })
  } catch (err) {
    console.error('[firebase-admin] Failed to initialise:', err)
    _app = null
  }

  return _app
}

/**
 * Send a single FCM push notification to a native device token.
 * No-ops silently if Firebase is not configured.
 */
export async function sendFcmNotification(
  token: string,
  notification: { title: string; body: string; url?: string },
): Promise<void> {
  const app = getApp()
  if (!app) return

  const { getMessaging } = require('firebase-admin/messaging')
  await getMessaging(app).send({
    token,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    ...(notification.url ? { data: { url: notification.url } } : {}),
    android: {
      priority: 'high',
    },
    apns: {
      payload: {
        aps: { sound: 'default' },
      },
    },
  })
}

/**
 * Send FCM to multiple tokens, collecting per-token results.
 */
export async function sendFcmBatch(
  tokens: string[],
  notification: { title: string; body: string; url?: string },
): Promise<{ sent: number; failed: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0 }

  const results = await Promise.allSettled(
    tokens.map(t => sendFcmNotification(t, notification)),
  )

  return {
    sent: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  }
}
