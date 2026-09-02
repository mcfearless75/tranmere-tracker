import { requireStaff } from '@/lib/auth/requireRole'
import { VALID_COURSEWORK_GRADES } from '@/lib/coursework/courseworkUtils'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type GradeInput = { student_id?: string; grade?: string | null }

export async function POST(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin } = auth.ctx

  const body = await request.json()
  const { grades } = body as { grades?: GradeInput[] }

  if (!Array.isArray(grades) || grades.length === 0) {
    return NextResponse.json({ error: 'grades must be a non-empty array' }, { status: 400 })
  }

  for (const g of grades) {
    if (!g.student_id) {
      return NextResponse.json({ error: 'every grade entry needs a student_id' }, { status: 400 })
    }
    if (g.grade !== null && g.grade !== undefined && !VALID_COURSEWORK_GRADES.includes(g.grade as (typeof VALID_COURSEWORK_GRADES)[number])) {
      return NextResponse.json({ error: `invalid grade value: ${g.grade}` }, { status: 400 })
    }
  }

  const { data: assignment, error: assignmentError } = await admin
    .from('assignments')
    .select('id, unit_id')
    .eq('id', params.assignmentId)
    .maybeSingle()

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 })
  }
  if (!assignment) {
    return NextResponse.json({ error: 'assignment not found' }, { status: 404 })
  }

  const { data: unit, error: unitError } = await admin
    .from('btec_units')
    .select('id, course_id')
    .eq('id', assignment.unit_id)
    .maybeSingle()

  if (unitError) {
    return NextResponse.json({ error: unitError.message }, { status: 500 })
  }
  if (!unit) {
    return NextResponse.json({ error: 'assignment has no valid unit' }, { status: 500 })
  }

  const { data: eligibleStudents, error: eligibleStudentsError } = await admin
    .from('users')
    .select('id')
    .eq('role', 'student')
    .eq('course_id', unit.course_id)

  if (eligibleStudentsError) {
    return NextResponse.json({ error: eligibleStudentsError.message }, { status: 500 })
  }

  const eligibleIds = new Set((eligibleStudents ?? []).map(s => s.id))

  for (const g of grades) {
    if (!eligibleIds.has(g.student_id as string)) {
      return NextResponse.json({ error: `student ${g.student_id} is not enrolled on this assignment's course` }, { status: 400 })
    }
  }

  const now = new Date().toISOString()
  const rows = grades.map(g => ({
    assignment_id: params.assignmentId,
    student_id: g.student_id,
    grade: g.grade ?? null,
    graded_by: user.id,
    graded_at: g.grade ? now : null,
    updated_at: now,
  }))

  const { error } = await admin
    .from('assignment_grades')
    .upsert(rows, { onConflict: 'assignment_id,student_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
