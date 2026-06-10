import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/youth/staffGate'
import { validateYouthPlayer, YouthPlayerInput } from '@/lib/youth/youthUtils'

export const dynamic = 'force-dynamic'

const EDITABLE_STRING_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'parent_guardian_name',
  'parent_contact_email',
] as const

const NULLABLE_STRING_FIELDS = ['parent_contact_phone', 'medical_notes'] as const

type ExistingPlayer = YouthPlayerInput & { id: string; squad_id: string }

export async function PATCH(
  request: NextRequest,
  { params }: { params: { playerId: string } },
) {
  const userId = await requireStaff()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const raw = (body ?? {}) as Record<string, unknown>

  const admin = createAdminClient()
  const { data: existingRow } = await admin
    .from('youth_players')
    .select('*')
    .eq('id', params.playerId)
    .maybeSingle()

  if (!existingRow) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const existing = existingRow as ExistingPlayer
  const update: Record<string, unknown> = {}

  for (const field of EDITABLE_STRING_FIELDS) {
    if (raw[field] === undefined) continue
    if (typeof raw[field] !== 'string') {
      return NextResponse.json({ error: `${field} must be a string` }, { status: 400 })
    }
    update[field] = (raw[field] as string).trim()
  }

  for (const field of NULLABLE_STRING_FIELDS) {
    if (raw[field] === undefined) continue
    if (raw[field] !== null && typeof raw[field] !== 'string') {
      return NextResponse.json({ error: `${field} must be a string or null` }, { status: 400 })
    }
    update[field] =
      typeof raw[field] === 'string' && (raw[field] as string).trim() !== ''
        ? (raw[field] as string).trim()
        : null
  }

  if (raw.consent_given !== undefined) {
    if (typeof raw.consent_given !== 'boolean') {
      return NextResponse.json({ error: 'consent_given must be a boolean' }, { status: 400 })
    }
    update.consent_given = raw.consent_given
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
  }

  // Validate the merged record so a partial update can never produce an
  // invalid player (e.g. clearing the parent email or revoking consent).
  const pickString = (value: unknown, fallback: string): string =>
    typeof value === 'string' ? value : fallback

  const merged: YouthPlayerInput = {
    first_name: pickString(update.first_name, existing.first_name),
    last_name: pickString(update.last_name, existing.last_name),
    date_of_birth: pickString(update.date_of_birth, existing.date_of_birth),
    parent_guardian_name: pickString(update.parent_guardian_name, existing.parent_guardian_name),
    parent_contact_email: pickString(update.parent_contact_email, existing.parent_contact_email),
    parent_contact_phone:
      'parent_contact_phone' in update
        ? (update.parent_contact_phone as string | null)
        : existing.parent_contact_phone ?? null,
    medical_notes:
      'medical_notes' in update
        ? (update.medical_notes as string | null)
        : existing.medical_notes ?? null,
    consent_given:
      typeof update.consent_given === 'boolean' ? update.consent_given : existing.consent_given,
  }

  const validation = validateYouthPlayer(merged)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { data, error } = await admin
    .from('youth_players')
    .update(update)
    .eq('id', params.playerId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed to update player' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  return NextResponse.json({ player: data })
}
