import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'coach', 'teacher']
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

async function requireStaff(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) return null
  return user.id
}

export async function POST(request: NextRequest) {
  const userId = await requireStaff()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, event_date: eventDate, location, notes } = (body ?? {}) as Record<string, unknown>

  if (typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (typeof eventDate !== 'string' || !ISO_DATE_PATTERN.test(eventDate)) {
    return NextResponse.json({ error: 'event_date must be a YYYY-MM-DD date' }, { status: 400 })
  }
  if (location !== undefined && location !== null && typeof location !== 'string') {
    return NextResponse.json({ error: 'location must be a string' }, { status: 400 })
  }
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return NextResponse.json({ error: 'notes must be a string' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('trial_events')
    .insert({
      title: title.trim(),
      event_date: eventDate,
      location: typeof location === 'string' && location.trim() !== '' ? location.trim() : null,
      notes: typeof notes === 'string' && notes.trim() !== '' ? notes.trim() : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ event: data }, { status: 201 })
}
