// Staff action for recording a known reason a student isn't expected in
// (parent called/emailed: ill or at an appointment). Replaces the dishonest
// "mark present" workaround (OverrideButton) for this case, and is read by
// the missed-checkin-sweep / attendance-safeguarding-check crons and the
// weekly report to suppress alerts and exclude authorised absence from the
// attendance %. See docs/superpowers/specs/2026-09-08-attendance-excusals-design.md

import { requireStaff } from '@/lib/auth/requireRole'
import { isValidExcuseRequest, buildExcusalRow, removePhase, resolvePhases, stripCheckedPhases } from '@/lib/attendance/excusal'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin } = auth.ctx

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null || !isValidExcuseRequest(body)) {
    return NextResponse.json(
      { error: 'Expected { studentId, date: YYYY-MM-DD, action: excuse|clear|clear_phase, reason?: ill|appointment|other, note?, phases?, phase? }' },
      { status: 400 },
    )
  }

  const { studentId, date, action } = body

  const { data: student } = await admin
    .from('users')
    .select('id, role')
    .eq('id', studentId)
    .maybeSingle()
  if (!student || student.role !== 'student') {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  if (action === 'clear') {
    const { error } = await admin
      .from('attendance_excusals')
      .delete()
      .eq('student_id', studentId)
      .eq('excused_date', date)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action })
  }

  if (action === 'clear_phase') {
    const { data: existing } = await admin
      .from('attendance_excusals')
      .select('phases')
      .eq('student_id', studentId)
      .eq('excused_date', date)
      .maybeSingle()
    if (!existing) return NextResponse.json({ ok: true, action, phases: [] })

    const remaining = removePhase(existing.phases, body.phase)
    if (remaining.length === 0) {
      const { error } = await admin
        .from('attendance_excusals')
        .delete()
        .eq('student_id', studentId)
        .eq('excused_date', date)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await admin
        .from('attendance_excusals')
        .update({ phases: remaining })
        .eq('student_id', studentId)
        .eq('excused_date', date)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, action, phases: remaining })
  }

  // action === 'excuse' — drop any requested phase that already has a real
  // check-in, so an excusal can never claim a phase the student actually
  // attended (see stripCheckedPhases).
  const { data: existingAttendance } = await admin
    .from('daily_attendance')
    .select('am_checked_at, lunch_checked_at, pm_checked_at')
    .eq('student_id', studentId)
    .eq('attendance_date', date)
    .maybeSingle()

  const requestedPhases = resolvePhases(body.phases)
  const phases = stripCheckedPhases(requestedPhases, {
    am: existingAttendance?.am_checked_at != null,
    lunch: existingAttendance?.lunch_checked_at != null,
    pm: existingAttendance?.pm_checked_at != null,
  })

  if (phases.length === 0) {
    return NextResponse.json(
      { error: 'This student is already checked in for every requested phase — nothing to excuse.' },
      { status: 409 },
    )
  }

  const row = buildExcusalRow(studentId, date, body.reason, body.note, phases, user.id)
  const { error } = await admin
    .from('attendance_excusals')
    .upsert(row, { onConflict: 'student_id,excused_date' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, action, reason: body.reason, phases: row.phases })
}
