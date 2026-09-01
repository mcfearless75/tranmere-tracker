// Vercel Cron: GET /api/cron/timetable-reminders — runs every 5 minutes,
// Mon-Fri, 06:00-18:59 UTC (covers 07:00-19:59 BST and 06:00-18:59 GMT).
// Sends a push notification to a slot's year-group students ~15 minutes
// before it starts. Idempotent via timetable_reminder_log even if two
// invocations somehow overlap.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { sendFcmBatch } from '@/lib/firebase-admin'
import { verifyCronSecret } from '@/lib/security'
import { londonDateISO, londonWeekday } from '@/lib/dates'
import { getSlotsDueForReminder } from '@/lib/timetable/timetableUtils'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const todayISO = londonDateISO(now)
  const weekday = londonWeekday(now)

  const { data: todaysSlots } = await admin
    .from('timetable_slots')
    .select('id, year_group, title, start_time, end_time, location, day_of_week')
    .eq('day_of_week', weekday)

  if (!todaysSlots?.length) return NextResponse.json({ sent: 0, slots: 0 })

  const dueSlots = getSlotsDueForReminder(todaysSlots, now, todayISO)
  if (!dueSlots.length) return NextResponse.json({ sent: 0, slots: 0 })

  const { data: alreadySent } = await admin
    .from('timetable_reminder_log')
    .select('slot_id')
    .eq('session_date', todayISO)
    .in('slot_id', dueSlots.map(s => s.id))

  const alreadySentIds = new Set((alreadySent ?? []).map(r => r.slot_id))
  const pendingSlots = dueSlots.filter(s => !alreadySentIds.has(s.id))
  if (!pendingSlots.length) return NextResponse.json({ sent: 0, slots: 0 })

  let totalWebSent = 0
  let totalFcmSent = 0

  for (const slot of pendingSlots) {
    const { data: students } = await admin
      .from('users')
      .select('id')
      .eq('role', 'student')
      .eq('year_group', slot.year_group)
    const studentIds = (students ?? []).map(s => s.id)

    if (studentIds.length > 0) {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', studentIds)
      const { data: nativeTokens } = await admin
        .from('native_push_tokens')
        .select('token')
        .in('user_id', studentIds)
      const tokens = (nativeTokens ?? []).map(r => r.token as string)

      const payload = {
        title: `⏰ ${slot.title} in 15 mins`,
        body: [slot.location, `starts ${slot.start_time.slice(0, 5)}`].filter(Boolean).join(' · '),
        url: '/timetable',
      }

      const webResults = await Promise.allSettled(
        (subs ?? []).map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
      )
      totalWebSent += webResults.filter(r => r.status === 'fulfilled').length

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
    }

    await admin.from('timetable_reminder_log').insert({ slot_id: slot.id, session_date: todayISO })
  }

  return NextResponse.json({ sent: totalWebSent + totalFcmSent, slots: pendingSlots.length })
}
