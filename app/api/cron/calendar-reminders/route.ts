// Vercel Cron: daily "event tomorrow" reminder to EVERYONE (students, parents,
// staff) — always at 9am LONDON TIME, correctly through the BST/GMT clock
// change. Same DST-safe dual-schedule trick as lunch-ending: vercel.json fires
// this route twice, at 08:00 and 09:00 UTC (one covers BST, the other GMT);
// this handler checks the real London hour via Intl and only sends when it's
// actually 9, so exactly one of the two invocations does anything on any given
// day — self-correcting across the clock change with no manual schedule edit.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { sendFcmBatch } from '@/lib/firebase-admin'
import { verifyCronSecret } from '@/lib/security'
import { londonHour, londonDateISO } from '@/lib/dates'
import { formatEventTime } from '@/lib/calendar/calendarUtils'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  if (londonHour(now) !== 9) {
    return NextResponse.json({ skipped: true, reason: 'not 9am London time', londonHour: londonHour(now) })
  }

  const admin = createAdminClient()

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000)
  const tomorrowISO = londonDateISO(tomorrow)

  const { data: events } = await admin
    .from('calendar_events')
    .select('id, title, event_time, description')
    .eq('event_date', tomorrowISO)
    .is('reminder_sent_at', null)

  if (!events?.length) return NextResponse.json({ sent: 0, events: 0 })

  // Audience is everyone who can see the calendar — no role filter.
  const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth')
  const { data: nativeTokens } = await admin.from('native_push_tokens').select('token')
  const tokens = (nativeTokens ?? []).map(r => r.token as string)

  let totalWebSent = 0
  let totalFcmSent = 0

  for (const event of events) {
    const bodyParts: string[] = []
    if (event.event_time) bodyParts.push(formatEventTime(event.event_time))
    if (event.description) bodyParts.push(event.description.slice(0, 80))
    const payload = {
      title: `📅 Tomorrow: ${event.title}`,
      body: bodyParts.join(' · ') || 'Tomorrow',
      url: '/dashboard',
    }

    const webResults = await Promise.allSettled(
      (subs ?? []).map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
    )
    totalWebSent += webResults.filter(r => r.status === 'fulfilled').length

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

    if (tokens.length > 0) {
      const fcmResult = await sendFcmBatch(tokens, payload)
      totalFcmSent += fcmResult.sent
    }

    // Idempotency: never re-send for this event, even if the cron re-runs.
    await admin.from('calendar_events').update({ reminder_sent_at: new Date().toISOString() }).eq('id', event.id)
  }

  return NextResponse.json({ sent: totalWebSent + totalFcmSent, events: events.length })
}
