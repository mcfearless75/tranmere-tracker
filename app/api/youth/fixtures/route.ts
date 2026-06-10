import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/youth/staffGate'

export const dynamic = 'force-dynamic'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const OPPONENT_MAX_LENGTH = 120
const NOTES_MAX_LENGTH = 1000

export async function POST(request: NextRequest) {
  const userId = await requireStaff()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    squad_id: squadId,
    opponent,
    fixture_date: fixtureDate,
    kick_off: kickOff,
    location,
    home_away: homeAway,
    notes,
  } = (body ?? {}) as Record<string, unknown>

  if (typeof squadId !== 'string' || squadId.trim() === '') {
    return NextResponse.json({ error: 'squad_id is required' }, { status: 400 })
  }
  if (typeof opponent !== 'string' || opponent.trim() === '') {
    return NextResponse.json({ error: 'opponent is required' }, { status: 400 })
  }
  if (opponent.trim().length > OPPONENT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `opponent must be ${OPPONENT_MAX_LENGTH} characters or fewer` },
      { status: 400 },
    )
  }
  if (typeof fixtureDate !== 'string' || !ISO_DATE_PATTERN.test(fixtureDate)) {
    return NextResponse.json({ error: 'fixture_date must be a YYYY-MM-DD date' }, { status: 400 })
  }
  if (kickOff !== undefined && kickOff !== null) {
    if (typeof kickOff !== 'string' || !TIME_PATTERN.test(kickOff)) {
      return NextResponse.json({ error: 'kick_off must be a HH:MM time' }, { status: 400 })
    }
  }
  if (location !== undefined && location !== null && typeof location !== 'string') {
    return NextResponse.json({ error: 'location must be a string' }, { status: 400 })
  }
  if (homeAway !== 'home' && homeAway !== 'away') {
    return NextResponse.json({ error: "home_away must be 'home' or 'away'" }, { status: 400 })
  }
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return NextResponse.json({ error: 'notes must be a string' }, { status: 400 })
  }
  if (typeof notes === 'string' && notes.length > NOTES_MAX_LENGTH) {
    return NextResponse.json(
      { error: `notes must be ${NOTES_MAX_LENGTH} characters or fewer` },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  const { data: squad } = await admin
    .from('youth_squads')
    .select('id')
    .eq('id', squadId)
    .maybeSingle()

  if (!squad) return NextResponse.json({ error: 'Squad not found' }, { status: 404 })

  const { data, error } = await admin
    .from('youth_fixtures')
    .insert({
      squad_id: squadId,
      opponent: opponent.trim(),
      fixture_date: fixtureDate,
      kick_off: typeof kickOff === 'string' ? kickOff : null,
      location: typeof location === 'string' && location.trim() !== '' ? location.trim() : null,
      home_away: homeAway,
      notes: typeof notes === 'string' && notes.trim() !== '' ? notes.trim() : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create fixture' }, { status: 500 })

  return NextResponse.json({ fixture: data }, { status: 201 })
}
