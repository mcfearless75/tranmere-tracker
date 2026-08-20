import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Serves the VAPID public key to the browser for web-push subscription.
 * The public key is not a secret — it ships inside every push subscription —
 * but serving it from the server means the client no longer depends on a
 * NEXT_PUBLIC_* build-time env var being configured in Vercel (the cause of
 * web push silently never working: the client bundle had undefined).
 */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null
  if (!key) {
    return NextResponse.json({ key: null, error: 'VAPID public key not configured' }, { status: 503 })
  }
  return NextResponse.json({ key })
}
