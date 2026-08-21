import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

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

  const { error } = await admin
    .from('calendar_events')
    .update({
      title: title.trim(),
      event_date,
      event_time: event_time || null,
      description: description?.trim() || null,
      updated_at: new Date().toISOString(),
      reminder_sent_at: null,
    })
    .eq('id', params.eventId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const { error } = await admin.from('calendar_events').delete().eq('id', params.eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
