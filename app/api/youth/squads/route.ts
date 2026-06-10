import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/youth/staffGate'
import { AGE_GROUPS, AgeGroup } from '@/lib/youth/youthUtils'

export const dynamic = 'force-dynamic'

const NAME_MAX_LENGTH = 80
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

  const { name, age_group: ageGroup, coach_id: coachId, notes } =
    (body ?? {}) as Record<string, unknown>

  if (typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (name.trim().length > NAME_MAX_LENGTH) {
    return NextResponse.json(
      { error: `name must be ${NAME_MAX_LENGTH} characters or fewer` },
      { status: 400 },
    )
  }
  if (typeof ageGroup !== 'string' || !AGE_GROUPS.includes(ageGroup as AgeGroup)) {
    return NextResponse.json(
      { error: `age_group must be one of ${AGE_GROUPS.join(', ')}` },
      { status: 400 },
    )
  }
  if (coachId !== undefined && coachId !== null && typeof coachId !== 'string') {
    return NextResponse.json({ error: 'coach_id must be a string' }, { status: 400 })
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
  const { data, error } = await admin
    .from('youth_squads')
    .insert({
      name: name.trim(),
      age_group: ageGroup,
      coach_id: typeof coachId === 'string' && coachId.trim() !== '' ? coachId : null,
      notes: typeof notes === 'string' && notes.trim() !== '' ? notes.trim() : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create squad' }, { status: 500 })

  return NextResponse.json({ squad: data }, { status: 201 })
}
