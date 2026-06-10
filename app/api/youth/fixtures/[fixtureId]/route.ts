import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/youth/staffGate'

export const dynamic = 'force-dynamic'

const MAX_GOALS = 99

function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_GOALS
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { fixtureId: string } },
) {
  const userId = await requireStaff()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { result_home: resultHome, result_away: resultAway, notes } =
    (body ?? {}) as Record<string, unknown>

  if (!isValidScore(resultHome)) {
    return NextResponse.json(
      { error: `result_home must be an integer between 0 and ${MAX_GOALS}` },
      { status: 400 },
    )
  }
  if (!isValidScore(resultAway)) {
    return NextResponse.json(
      { error: `result_away must be an integer between 0 and ${MAX_GOALS}` },
      { status: 400 },
    )
  }
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return NextResponse.json({ error: 'notes must be a string' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    result_home: resultHome,
    result_away: resultAway,
  }
  if (notes !== undefined) {
    update.notes = typeof notes === 'string' && notes.trim() !== '' ? notes.trim() : null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('youth_fixtures')
    .update(update)
    .eq('id', params.fixtureId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed to record result' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })

  return NextResponse.json({ fixture: data })
}
