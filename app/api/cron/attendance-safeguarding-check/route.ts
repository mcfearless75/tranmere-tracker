// Staff nudge only. Missing lunch/PM stays on Home + the register.
// Do not open safeguarding cases for forgotten taps.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { verifyCronSecret } from '@/lib/security'
import { londonDateISO } from '@/lib/dates'
import { toMinutes, londonMinutes } from '@/lib/attendance/phase'
import { excusalCoversPhase } from '@/lib/attendance/excusal'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const NUDGE_GRACE_MINUTES = 30

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
  if (nowMinutes < pmStart + NUDGE_GRACE_MINUTES) {
    return NextResponse.json({ skipped: true, reason: 'grace period not reached yet' })
  }

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

  const atRisk = (students ?? []).filter(s => {
    const row = rowByStudent.get(s.id)
    if (row?.am_checked_at == null || row.lunch_checked_at != null || row.pm_checked_at != null) return false
    return !excusalCoversPhase(excusalByStudent.get(s.id), 'lunch')
  })

  if (!atRisk.length) return NextResponse.json({ checked: 0, nudged: 0 })

  const { data: existingNudge } = await admin
    .from('attendance_safeguarding_nudge_log')
    .select('attendance_date')
    .eq('attendance_date', today)
    .maybeSingle()

  if (existingNudge) return NextResponse.json({ checked: atRisk.length, nudged: 0 })

  const { data: nudgeLogRows } = await admin
    .from('attendance_safeguarding_nudge_log')
    .upsert({ attendance_date: today, notified_count: atRisk.length }, { onConflict: 'attendance_date', ignoreDuplicates: true })
    .select('attendance_date')

  if (!nudgeLogRows?.length) return NextResponse.json({ checked: atRisk.length, nudged: 0 })

  const { data: staff } = await admin.from('users').select('id').in('role', ['admin', 'coach', 'teacher'])
  const { data: subs } = staff?.length
    ? await admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', staff.map(d => d.id))
    : { data: [] }

  const names = atRisk.slice(0, 3).map(s => s.name?.split(' ')[0] ?? 'Unknown').join(', ')
  const more = atRisk.length > 3 ? ` +${atRisk.length - 3} more` : ''
  const nudgePayload = {
    title: `${atRisk.length} quiet since lunch`,
    body: `${names}${more} checked in this morning but not since. Mark them on the register if they are in.`,
    url: '/admin/attendance',
  }

  await Promise.allSettled(
    (subs ?? []).map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, nudgePayload)),
  )

  return NextResponse.json({ checked: atRisk.length, nudged: atRisk.length, cases: 0 })
}
