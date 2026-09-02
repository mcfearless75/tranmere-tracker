import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const body = await request.json()
  const { unit_id, title, description, due_date, grade_target } = body as {
    unit_id?: string
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
  if (!unit_id) {
    return NextResponse.json({ error: 'unit_id is required' }, { status: 400 })
  }

  const { data: unit, error: unitError } = await admin
    .from('btec_units')
    .select('id')
    .eq('id', unit_id)
    .maybeSingle()

  if (unitError) {
    return NextResponse.json({ error: unitError.message }, { status: 500 })
  }
  if (!unit) {
    return NextResponse.json({ error: 'unit_id does not reference a real unit' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('assignments')
    .insert({
      unit_id,
      title: title.trim(),
      description: description?.trim() || null,
      due_date,
      grade_target: grade_target?.trim() || null,
    })
    .select('id, unit_id, title, description, due_date, grade_target, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignment: data })
}
