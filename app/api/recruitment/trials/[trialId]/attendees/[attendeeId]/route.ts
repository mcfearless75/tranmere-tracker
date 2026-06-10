import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'coach', 'teacher']
const MIN_RATING = 1
const MAX_RATING = 10

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { trialId: string; attendeeId: string } },
) {
  const userId = await requireStaff()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { attended, rating, scout_notes: scoutNotes } = (body ?? {}) as Record<string, unknown>

  const updates: Record<string, boolean | number | string | null> = {}

  if (attended !== undefined) {
    if (typeof attended !== 'boolean') {
      return NextResponse.json({ error: 'attended must be a boolean' }, { status: 400 })
    }
    updates.attended = attended
  }
  if (rating !== undefined) {
    if (rating !== null && (typeof rating !== 'number' || !Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING)) {
      return NextResponse.json({ error: 'rating must be an integer between 1 and 10' }, { status: 400 })
    }
    updates.rating = rating as number | null
  }
  if (scoutNotes !== undefined) {
    if (scoutNotes !== null && typeof scoutNotes !== 'string') {
      return NextResponse.json({ error: 'scout_notes must be a string' }, { status: 400 })
    }
    updates.scout_notes =
      typeof scoutNotes === 'string' && scoutNotes.trim() !== '' ? scoutNotes.trim() : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('trial_attendees')
    .update(updates)
    .eq('id', params.attendeeId)
    .eq('trial_event_id', params.trialId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Attendee not found' }, { status: 404 })

  return NextResponse.json({ attendee: data })
}
