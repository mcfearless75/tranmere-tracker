// Staff fallback for when a student's phone dies (or an NFC tap fails):
// mark a phase present, or clear a phase, directly from the admin day view.
// Manual marks are always flagged with "Manual override by <staff>" so they
// can never be mistaken for a real tap.

import { requireStaff } from '@/lib/auth/requireRole'
import { buildOverridePatch, isValidOverrideRequest } from '@/lib/attendance/manualOverride'
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

  if (typeof body !== 'object' || body === null || !isValidOverrideRequest(body)) {
    return NextResponse.json(
      { error: 'Expected { studentId, date: YYYY-MM-DD, phase: am|lunch|pm, action: mark_present|clear }' },
      { status: 400 },
    )
  }
  const { studentId, date, phase, action } = body

  // Target must be an actual student
  const { data: student } = await admin
    .from('users')
    .select('id, role')
    .eq('id', studentId)
    .maybeSingle()
  if (!student || student.role !== 'student') {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  // Caller's display name for the audit reason
  const { data: staffProfile } = await admin
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()
  const staffName = staffProfile?.name ?? user.email ?? 'staff'

  const patch = buildOverridePatch(phase, action, staffName)

  const { error } = await admin
    .from('daily_attendance')
    .upsert(
      { student_id: studentId, attendance_date: date, ...patch },
      { onConflict: 'student_id,attendance_date' },
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, phase, action })
}
