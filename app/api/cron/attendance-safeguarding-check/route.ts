// Vercel Cron: "a student was on site this morning, then never checked in
// for lunch or the afternoon — where are they?" This is a duty-of-care
// question, not a routine attendance metric, so it auto-raises a real
// safeguarding_concerns case (the DSL's existing admin-only casework
// module — supabase/migrations/030_safeguarding.sql) rather than just
// firing a push that can be missed or ignored.
//
// Deliberately narrower than missed-checkin-sweep: only fires for a student
// who WAS checked in this morning (am_checked_at set) and is then missing
// BOTH lunch and PM by a grace period after the afternoon session should
// have started. A student who simply never arrived at all today is a
// routine absence, already visible on the day view — not this.
//
// Trigger is pm_window_start + grace, not pm_window_end — the PM window
// stays open till 23:59 for late finishers, so "window closed" doesn't mean
// anything here; "lessons should have resumed by now" does.
//
// Runs every 15 min through the working day (window times are staff-
// configurable, so a fixed UTC schedule can't target the exact deadline).
// Dedup is per-student: skips anyone who already has an attendance-category
// concern raised today, so re-running never double-raises the same case.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { verifyCronSecret } from '@/lib/security'
import { londonDateISO, londonWallTimeToUTC } from '@/lib/dates'
import { toMinutes, londonMinutes } from '@/lib/attendance/phase'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GRACE_MINUTES = 30

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const today = londonDateISO(now)

  const { data: settings } = await admin
    .from('academy_settings')
    .select('pm_window_start')
    .eq('id', 1)
    .maybeSingle()
  if (!settings) return NextResponse.json({ error: 'Academy not configured' }, { status: 500 })

  const deadline = toMinutes(settings.pm_window_start) + GRACE_MINUTES
  if (londonMinutes(now) < deadline) {
    return NextResponse.json({ skipped: true, reason: 'grace period not reached yet' })
  }

  const [{ data: students }, { data: rows }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student'),
    admin
      .from('daily_attendance')
      .select('student_id, am_checked_at, lunch_checked_at, pm_checked_at')
      .eq('attendance_date', today),
  ])

  const rowByStudent = new Map((rows ?? []).map(r => [r.student_id, r]))

  // Was here this morning, then went quiet for both lunch and the afternoon.
  const atRisk = (students ?? []).filter(s => {
    const row = rowByStudent.get(s.id)
    return row?.am_checked_at != null && row.lunch_checked_at == null && row.pm_checked_at == null
  })

  if (!atRisk.length) return NextResponse.json({ checked: 0 })

  const todayStartUTC = londonWallTimeToUTC(today, '00:00').toISOString()

  const raised: { id: string; name: string }[] = []

  for (const student of atRisk) {
    // Per-student dedup — never raise a second case for the same student on
    // the same day, however many times this sweep re-runs.
    const { data: already } = await admin
      .from('safeguarding_concerns')
      .select('id')
      .eq('student_id', student.id)
      .eq('category', 'attendance')
      .gte('created_at', todayStartUTC)
      .limit(1)
      .maybeSingle()
    if (already) continue

    const row = rowByStudent.get(student.id)
    const amTime = row?.am_checked_at
      ? new Date(row.am_checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
      : 'this morning'
    const nowTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

    const { data: concern } = await admin
      .from('safeguarding_concerns')
      .insert({
        student_id: student.id,
        raised_by: null, // system-raised, no admin user
        category: 'attendance',
        severity: 'high',
        description:
          `Auto-detected by the attendance system: ${student.name ?? 'This student'} checked in at ${amTime} ` +
          `but has not checked in for lunch or the afternoon session as of ${nowTime}. ` +
          `Please locate the student and confirm their welfare.`,
        status: 'open',
      })
      .select('id')
      .single()

    if (concern) raised.push({ id: concern.id, name: student.name ?? 'Unknown' })
  }

  if (!raised.length) return NextResponse.json({ checked: atRisk.length, raised: 0 })

  // Safeguarding cases are admin-only (the DSL) — coaches/teachers can't
  // even open the linked page, so unlike every other alert in this app this
  // does NOT go to the wider staff group.
  const { data: dsl } = await admin.from('users').select('id').eq('role', 'admin')
  const { data: subs } = dsl?.length
    ? await admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', dsl.map(d => d.id))
    : { data: [] }

  const names = raised.slice(0, 3).map(r => r.name.split(' ')[0]).join(', ')
  const more = raised.length > 3 ? ` +${raised.length - 3} more` : ''
  const payload = {
    title: `🚨 Safeguarding: ${raised.length} unaccounted for since lunch`,
    body: `${names}${more} checked in this morning but hasn't been seen since lunch. Case${raised.length > 1 ? 's' : ''} opened.`,
    url: '/admin/safeguarding',
  }

  await Promise.allSettled(
    (subs ?? []).map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
  )

  return NextResponse.json({ checked: atRisk.length, raised: raised.length })
}
