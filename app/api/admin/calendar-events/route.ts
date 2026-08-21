import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin } = auth.ctx

  const body = await request.json()
  const { title, event_date, event_time, description } = body as {
    title?: string
    event_date?: string
    event_time?: string | null
    description?: string | null
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    return NextResponse.json({ error: 'event_date must be YYYY-MM-DD' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('calendar_events')
    .insert({
      title: title.trim(),
      event_date,
      event_time: event_time || null,
      description: description?.trim() || null,
      created_by: user.id,
    })
    .select('id, title, event_date, event_time, description, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}
