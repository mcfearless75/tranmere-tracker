import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const body = await request.json()
  const { title, description, due_date, grade_target } = body as {
    title?: string
    description?: string | null
    due_date?: string
    grade_target?: string | null
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!due_date) {
    return NextResponse.json({ error: 'due_date is required' }, { status: 400 })
  }

  const { error } = await admin
    .from('assignments')
    .update({
      title: title.trim(),
      description: description?.trim() || null,
      due_date,
      grade_target: grade_target?.trim() || null,
    })
    .eq('id', params.assignmentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const { error } = await admin.from('assignments').delete().eq('id', params.assignmentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
