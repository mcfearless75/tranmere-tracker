// Vercel Cron: "a student was on site this morning, then never checked in
// for lunch or the afternoon — where are they?" This is a duty-of-care
// question, not a routine attendance metric, so it auto-raises a real
// safeguarding_concerns case (the DSL's existing admin-only casework
// module — supabase/migrations/030_safeguarding.sql) rather than just
// firing a push that can be missed or ignored.
//
// TWO-STAGE grace (added 2026-09-08 after one run auto-raised 28 cases in a
// single batch — mostly students who'd simply forgotten to tap in for lunch,
// not genuine whereabouts emergencies, per that day's actual check-in data):
//   Stage 1 (NUDGE_GRACE_MINUTES after pm_window_start): push nudge to staff
//     only, no case raised — deduped once per day via
//     attendance_safeguarding_nudge_log (supabase/migrations/064).
//   Stage 2 (CASE_GRACE_MINUTES after pm_window_start): re-check the SAME
//     cohort fresh — anyone who's since checked in or been excused naturally
//     drops out — and for anyone STILL unaccounted for, raise the actual
//     case. This is the original single-stage logic, unchanged, just gated
//     behind a later threshold.
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
// Stage 2 dedup is per-student: skips anyone who already has an attendance-
// category concern raised today, so re-running never double-raises the same
// case.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { verifyCronSecret } from '@/lib/security'
import { londonDateISO } from '@/lib/dates'
import { toMinutes, londonMinutes } from '@/lib/attendance/phase'
import { excusalCoversPhase } from '@/lib/attendance/excusal'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const NUDGE_GRACE_MINUTES = 30 // stage 1: push nudge only, no case raised
const CASE_GRACE_MINUTES = 90  // stage 2: raise a real case for anyone still unaccounted for

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
    .select('pm_window_start')
    .eq('id', 1)
    .maybeSingle()
  if (!settings) return NextResponse.json({ error: 'Academy not configured' }, { status: 500 })

  const pmStart = toMinutes(settings.pm_window_start)
  const nudgeDeadline = pmStart + NUDGE_GRACE_MINUTES
  const caseDeadline = pmStart + CASE_GRACE_MINUTES

  if (nowMinutes < nudgeDeadline) {
    return NextResponse.json({ skipped: true, reason: 'grace period not reached yet' })
  }

  // Recomputed fresh on every run — a student who's since checked in for
  // lunch/pm, or been excused, drops out of this list on the next 15-min
  // pass, whether we're still in the nudge stage or already past the case
  // stage.
  const [{ data: students }, { data: rows }, { data: excusals }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student').eq('is_active', true),
    admin
      .from('daily_attendance')
      .select('student_id, am_checked_at, lunch_checked_at, pm_checked_at')
      .eq('attendance_date', today),
    admin.from('attendance_excusals').select('student_id, phases').eq('excused_date', today),
  ])

  const rowByStudent = new Map((rows ?? []).map(r => [r.student_id, r]))
  const excusalByStudent = new Map((excusals ?? []).map(e => [e.student_id, e]))

  // Was here this morning, then went quiet for both lunch and the afternoon —
  // unless staff already logged a known reason (e.g. sent home ill after AM,
  // an afternoon appointment) covering lunch.
  const atRisk = (students ?? []).filter(s => {
    const row = rowByStudent.get(s.id)
    if (row?.am_checked_at == null || row.lunch_checked_at != null || row.pm_checked_at != null) return false
    return !excusalCoversPhase(excusalByStudent.get(s.id), 'lunch')
  })

  const result: Record<string, unknown> = { checked: atRisk.length }

  // ── Stage 1: nudge (push only, once per day, no case raised) ─────────────
  if (atRisk.length) {
    const { data: existingNudge, error: existingNudgeError } = await admin
      .from('attendance_safeguarding_nudge_log')
      .select('attendance_date')
      .eq('attendance_date', today)
      .maybeSingle()

    if (existingNudgeError) {
      console.error('[attendance-safeguarding-check] nudge log lookup failed:', existingNudgeError)
    }

    if (!existingNudge) {
      // Race-guard identical in spirit to attendance_sweep_log: only the
      // invocation that wins this upsert sends the nudge. ignoreDuplicates
      // means a losing/repeat invocation gets zero rows back and no
      // Postgres-level error either — a plain .insert() here was generating
      // ~23 duplicate-key errors/day (the upfront select above isn't the
      // real guard on its own; two overlapping ticks can both pass it).
      const { data: nudgeLogRows, error: nudgeLogError } = await admin
        .from('attendance_safeguarding_nudge_log')
        .upsert({ attendance_date: today, notified_count: atRisk.length }, { onConflict: 'attendance_date', ignoreDuplicates: true })
        .select('attendance_date')

      if (nudgeLogError) {
        console.error('[attendance-safeguarding-check] nudge log upsert failed:', nudgeLogError)
      }

      if (nudgeLogRows?.length) {
        // Stage 1 is a "please go take a look" nudge — coaches/teachers are
        // the ones on site who can actually go find the student, so this
        // goes to the wider staff group (same targeting as
        // missed-checkin-sweep), unlike the admin-only stage-2 case push.
        const { data: staff } = await admin.from('users').select('id').in('role', ['admin', 'coach', 'teacher'])
        const { data: subs } = staff?.length
          ? await admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', staff.map(d => d.id))
          : { data: [] }

        const names = atRisk.slice(0, 3).map(s => s.name?.split(' ')[0] ?? 'Unknown').join(', ')
        const more = atRisk.length > 3 ? ` +${atRisk.length - 3} more` : ''
        const nudgePayload = {
          title: `👀 ${atRisk.length} quiet since lunch`,
          body: `${names}${more} checked in this morning but hasn't checked in since — please take a look. A safeguarding case opens automatically if still unaccounted for.`,
          url: '/admin/attendance',
        }

        await Promise.allSettled(
          (subs ?? []).map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, nudgePayload))
        )
        result.nudged = atRisk.length
      }
    }
  }

  // ── Stage 2: raise a case for anyone STILL unaccounted for ───────────────
  if (nowMinutes < caseDeadline || !atRisk.length) {
    return NextResponse.json(result)
  }

  const raised: { id: string; name: string }[] = []

  for (const student of atRisk) {
    const row = rowByStudent.get(student.id)
    const amTime = row?.am_checked_at
      ? new Date(row.am_checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
      : 'this morning'
    const nowTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

    // raise_attendance_safeguarding_concern() (migration 070) does the
    // check-and-insert atomically server-side: INSERT ... ON CONFLICT
    // (student_id, category, raised_date) WHERE raised_by IS NULL DO
    // NOTHING. safeguarding_concerns_one_auto_per_day is a PARTIAL unique
    // index, which PostgREST's upsert can't target (no WHERE support), so
    // a plain select-then-insert was the only REST-level option — and it
    // was generating ~490 duplicate-key Postgres errors/day (the same
    // already-cased student retried on every 15-min tick for the rest of
    // the day). This function returns zero rows, with no error at any
    // layer, when a case already exists for this student/day.
    const { data: rpcRows, error: rpcError } = await admin.rpc('raise_attendance_safeguarding_concern', {
      p_student_id: student.id,
      p_raised_date: today,
      p_description:
        `Auto-detected by the attendance system: ${student.name ?? 'This student'} checked in at ${amTime} ` +
        `but has not checked in for lunch or the afternoon session as of ${nowTime}. ` +
        `Please locate the student and confirm their welfare.`,
    })

    if (rpcError) {
      console.error('[attendance-safeguarding-check] raise_attendance_safeguarding_concern failed:', rpcError)
      continue
    }

    const concern = rpcRows?.[0]
    if (concern) raised.push({ id: concern.id, name: student.name ?? 'Unknown' })
  }

  if (!raised.length) return NextResponse.json({ ...result, raised: 0 })

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

  return NextResponse.json({ ...result, raised: raised.length })
}
