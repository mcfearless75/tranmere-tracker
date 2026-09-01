import { requireStaff } from '@/lib/auth/requireRole'
import { VALID_TIMETABLE_YEAR_GROUPS } from '@/lib/timetable/timetableUtils'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VALID_DAYS = [1, 2, 4, 5]

export async function POST(request: NextRequest) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin } = auth.ctx

  const body = await request.json()
  const { title, day_of_week, start_time, end_time, location, tutor, year_group } = body as {
    title?: string
    day_of_week?: number
    start_time?: string
    end_time?: string
    location?: string | null
    tutor?: string | null
    year_group?: number
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
  if (!VALID_TIMETABLE_YEAR_GROUPS.includes(Number(year_group))) {
    return NextResponse.json({ error: `year_group must be one of ${VALID_TIMETABLE_YEAR_GROUPS.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await admin
    .from('timetable_slots')
    .insert({
      title: title.trim(),
      day_of_week: Number(day_of_week),
      start_time,
      end_time,
      location: location?.trim() || null,
      tutor: tutor?.trim() || null,
      year_group: Number(year_group),
      created_by: user.id,
    })
    .select('id, title, day_of_week, start_time, end_time, location, tutor, year_group, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ slot: data })
}
