import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VALID_DAYS = [1, 2, 4, 5]

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slotId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const body = await request.json()
  const { title, day_of_week, start_time, end_time, location, tutor } = body as {
    title?: string
    day_of_week?: number
    start_time?: string
    end_time?: string
    location?: string | null
    tutor?: string | null
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!VALID_DAYS.includes(Number(day_of_week))) {
    return NextResponse.json({ error: 'day_of_week must be Monday, Tuesday, Thursday or Friday' }, { status: 400 })
  }
  if (!start_time || !end_time || start_time >= end_time) {
    return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 })
  }

  const { error } = await admin
    .from('timetable_slots')
    .update({
      title: title.trim(),
      day_of_week: Number(day_of_week),
      start_time,
      end_time,
      location: location?.trim() || null,
      tutor: tutor?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.slotId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slotId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const { error } = await admin.from('timetable_slots').delete().eq('id', params.slotId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
