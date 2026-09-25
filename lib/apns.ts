/**
 * Direct APNs (Apple Push Notification service) sender for the iOS app.
 *
 * Why not FCM: the iOS Capacitor build has no Firebase SDK, so
 * PushNotifications.register() hands back a raw 64-hex APNs device token.
 * FCM rejects those, so until 2026-09-25 every iOS notification failed
 * silently inside sendFcmBatch. Talking to APNs directly over HTTP/2 with a
 * token-based (.p8) key avoids adding Firebase to the Xcode project.
 *
 * Env (server-side only):
 *   APNS_KEY_P8     — contents of the AuthKey_XXXX.p8 file (PEM, \n-escaped ok)
 *   APNS_KEY_ID     — the 10-char Key ID shown next to that key
 *   APNS_TEAM_ID    — Apple Developer Team ID (defaults to F55TGQ7TD3)
 *   APNS_BUNDLE_ID  — defaults to com.tranmererovers.tracker
 *   APNS_SANDBOX    — "true" only for Xcode debug builds; TestFlight and
 *                     App Store builds use the production gateway
 *
 * No-ops (resolves) when not configured, matching firebase-admin.ts.
 */

import { connect, type ClientHttp2Session } from 'http2'
import { createSign } from 'crypto'

export type ApnsNotification = { title: string; body: string; url?: string }

const APNS_TOKEN_RE = /^[0-9a-f]{64}$/i

/** APNs device tokens are 32 bytes hex-encoded; FCM tokens are ~140+ chars with a colon. */
export function isApnsToken(token: string): boolean {
  return APNS_TOKEN_RE.test(token)
}

type ApnsConfig = { key: string; keyId: string; teamId: string; bundleId: string; host: string }

function getConfig(): ApnsConfig | null {
  const key = process.env.APNS_KEY_P8?.replace(/\\n/g, '\n')
  const keyId = process.env.APNS_KEY_ID
  if (!key || !keyId) return null
  return {
    key,
    keyId,
    teamId: process.env.APNS_TEAM_ID ?? 'F55TGQ7TD3',
    bundleId: process.env.APNS_BUNDLE_ID ?? 'com.tranmererovers.tracker',
    host: process.env.APNS_SANDBOX === 'true'
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com',
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

// Apple rejects provider tokens older than 1h and throttles ones refreshed
// more than every 20 min — reuse for 50 min.
let cachedJwt: { token: string; issuedAt: number } | null = null

export function buildApnsJwt(cfg: Pick<ApnsConfig, 'key' | 'keyId' | 'teamId'>, nowSec: number): string {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId }))
  const claims = base64url(JSON.stringify({ iss: cfg.teamId, iat: nowSec }))
  const signer = createSign('SHA256')
  signer.update(`${header}.${claims}`)
  const sig = signer.sign({ key: cfg.key, dsaEncoding: 'ieee-p1363' })
  return `${header}.${claims}.${base64url(sig)}`
}

function getJwt(cfg: ApnsConfig): string {
  const now = Math.floor(Date.now() / 1000)
  if (!cachedJwt || now - cachedJwt.issuedAt > 50 * 60) {
    cachedJwt = { token: buildApnsJwt(cfg, now), issuedAt: now }
  }
  return cachedJwt.token
}

function sendOne(
  session: ClientHttp2Session,
  cfg: ApnsConfig,
  jwt: string,
  token: string,
  n: ApnsNotification,
): Promise<void> {
  const payload = JSON.stringify({
    aps: { alert: { title: n.title, body: n.body }, sound: 'default' },
    // Same key FCM uses — PushNavigationListener reads notification.data.url
    ...(n.url ? { url: n.url } : {}),
  })
  return new Promise((resolve, reject) => {
    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': cfg.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    })
    let status = 0
    let body = ''
    req.setEncoding('utf8')
    req.on('response', h => { status = Number(h[':status']) })
    req.on('data', chunk => { body += chunk })
    req.on('end', () => (status === 200 ? resolve() : reject(new Error(`APNs ${status}: ${body}`))))
    req.on('error', reject)
    req.end(payload)
  })
}

/** Send to many APNs tokens over one HTTP/2 connection. */
export async function sendApnsBatch(
  tokens: string[],
  notification: ApnsNotification,
): Promise<{ sent: number; failed: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0 }
  const cfg = getConfig()
  if (!cfg) {
    console.warn('[apns] APNS_KEY_P8 / APNS_KEY_ID not set — skipping iOS push')
    return { sent: 0, failed: tokens.length }
  }

  const session = connect(cfg.host)
  session.on('error', err => console.error('[apns] session error:', err))
  try {
    const jwt = getJwt(cfg)
    const results = await Promise.allSettled(tokens.map(t => sendOne(session, cfg, jwt, t, notification)))
    results.forEach(r => { if (r.status === 'rejected') console.error('[apns]', r.reason) })
    return {
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    }
  } finally {
    session.close()
  }
}
