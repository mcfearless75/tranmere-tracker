// Vercel Cron: alerts staff when students still haven't checked in a fixed
// grace period after the AM or lunch window closes — closing the gap where a
// student who leaves site (or never arrives) and never attempts a check-in
// was invisible until the once-daily 17:30 PM digest.
//
// Scoped to AM and LUNCH only: the PM/end-of-day window is deliberately wide
// (till 23:59, so late finishers can still tap out), so "window just closed"
// isn't meaningful for it — that case is already covered by
// attendance-report-pm's 17:30 digest.
//
// Window end times are configurable in the admin settings UI, so a fixed UTC
// cron schedule can't target the exact grace deadline. Instead this runs
// every 15 minutes through the working day and self-gates: it only actually
// alerts once per phase per day, tracked in attendance_sweep_log.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { verifyCronSecret } from '@/lib/security'
import { londonDateISO } from '@/lib/dates'
import { toMinutes, londonMinutes } from '@/lib/attendance/phase'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GRACE_MINUTES = 20
const PHASES = ['am', 'lunch'] as const
type SweepPhase = typeof PHASES[number]

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const today = londonDateISO(now)
  const nowMinutes = londonMinutes(now)

  const { data: settings } = await admin
    .from('academy_settings')
    .select('am_window_end, lunch_window_end')
    .eq('id', 1)
    .maybeSingle()
  if (!settings) return NextResponse.json({ error: 'Academy not configured' }, { status: 500 })

  const deadlines: Record<SweepPhase, number> = {
    am: toMinutes(settings.am_window_end) + GRACE_MINUTES,
    lunch: toMinutes(settings.lunch_window_end) + GRACE_MINUTES,
  }

  const results: Record<string, unknown> = {}

  for (const phase of PHASES) {
    if (nowMinutes < deadlines[phase]) {
      results[phase] = { skipped: true, reason: 'grace period not reached yet' }
      continue
    }

    // Already swept this phase today — the once-per-day gate.
    const { data: existing } = await admin
      .from('attendance_sweep_log')
      .select('id')
      .eq('attendance_date', today)
      .eq('phase', phase)
      .maybeSingle()
    if (existing) {
      results[phase] = { skipped: true, reason: 'already swept' }
      continue
    }

    const [{ data: students }, { data: rows }] = await Promise.all([
      admin.from('users').select('id, name').eq('role', 'student'),
      admin.from('daily_attendance').select(`student_id, ${phase}_checked_at`).eq('attendance_date', today),
    ])

    const checkedField = `${phase}_checked_at` as const
    const checkedIds = new Set(
      (rows ?? [])
        .filter(r => (r as Record<string, unknown>)[checkedField] !== null)
        .map(r => (r as { student_id: string }).student_id)
    )
    const missing = (students ?? []).filter(s => !checkedIds.has(s.id))

    // Record the sweep regardless — the gate must fire exactly once per
    // phase per day whether or not anyone was actually missing.
    await admin.from('attendance_sweep_log').insert({
      attendance_date: today,
      phase,
      missing_count: missing.length,
    })

    if (!missing.length) {
      results[phase] = { sent: 0, missing: 0 }
      continue
    }

    const { data: staff } = await admin.from('users').select('id').in('role', ['admin', 'coach', 'teacher'])
    const { data: subs } = staff?.length
      ? await admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', staff.map(s => s.id))
      : { data: [] }

    const phaseName = phase === 'am' ? 'morning' : 'lunch'
    const names = missing.slice(0, 3).map(s => s.name?.split(' ')[0] ?? 'Unknown').join(', ')
    const more = missing.length > 3 ? ` +${missing.length - 3} more` : ''
    const payload = {
      title: `⚠️ ${missing.length} not checked in for ${phaseName}`,
      body: `${names}${more} — no ${phaseName} check-in ${GRACE_MINUTES}+ minutes after the window closed.`,
      url: '/admin/attendance',
    }

    const pushResults = await Promise.allSettled(
      (subs ?? []).map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
    )
    const sent = pushResults.filter(r => r.status === 'fulfilled').length

    results[phase] = { sent, missing: missing.length }
  }

  return NextResponse.json(results)
}
