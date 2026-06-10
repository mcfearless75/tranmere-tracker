import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'coach', 'teacher']

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

export async function POST(
  request: NextRequest,
  { params }: { params: { trialId: string } },
) {
  const userId = await requireStaff()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { prospect_id: prospectId } = (body ?? {}) as Record<string, unknown>

  if (typeof prospectId !== 'string' || prospectId.trim() === '') {
    return NextResponse.json({ error: 'prospect_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Confirm the trial event exists.
  const { data: event, error: eventError } = await admin
    .from('trial_events')
    .select('id')
    .eq('id', params.trialId)
    .maybeSingle()

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 })
  if (!event) return NextResponse.json({ error: 'Trial event not found' }, { status: 404 })

  // Confirm the prospect exists.
  const { data: prospect, error: prospectError } = await admin
    .from('recruitment_prospects')
    .select('id')
    .eq('id', prospectId)
    .maybeSingle()

  if (prospectError) return NextResponse.json({ error: prospectError.message }, { status: 500 })
  if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })

  // Reject duplicates ahead of the unique constraint for a friendlier error.
  const { data: existing, error: existingError } = await admin
    .from('trial_attendees')
    .select('id')
    .eq('trial_event_id', params.trialId)
    .eq('prospect_id', prospectId)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (existing) {
    return NextResponse.json({ error: 'Prospect is already on this trial' }, { status: 409 })
  }

  const { data, error } = await admin
    .from('trial_attendees')
    .insert({
      trial_event_id: params.trialId,
      prospect_id: prospectId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ attendee: data }, { status: 201 })
}
