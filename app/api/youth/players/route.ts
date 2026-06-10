import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/youth/staffGate'
import { validateYouthPlayer, YouthPlayerInput } from '@/lib/youth/youthUtils'

export const dynamic = 'force-dynamic'

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
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

  const raw = (body ?? {}) as Record<string, unknown>

  if (typeof raw.squad_id !== 'string' || raw.squad_id.trim() === '') {
    return NextResponse.json({ error: 'squad_id is required' }, { status: 400 })
  }

  const input: YouthPlayerInput = {
    first_name: typeof raw.first_name === 'string' ? raw.first_name : '',
    last_name: typeof raw.last_name === 'string' ? raw.last_name : '',
    date_of_birth: typeof raw.date_of_birth === 'string' ? raw.date_of_birth : '',
    parent_guardian_name:
      typeof raw.parent_guardian_name === 'string' ? raw.parent_guardian_name : '',
    parent_contact_email:
      typeof raw.parent_contact_email === 'string' ? raw.parent_contact_email : '',
    parent_contact_phone: asOptionalString(raw.parent_contact_phone),
    medical_notes: asOptionalString(raw.medical_notes),
    consent_given: raw.consent_given === true,
  }

  const validation = validateYouthPlayer(input)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: squad } = await admin
    .from('youth_squads')
    .select('id')
    .eq('id', raw.squad_id)
    .maybeSingle()

  if (!squad) return NextResponse.json({ error: 'Squad not found' }, { status: 404 })

  const { data, error } = await admin
    .from('youth_players')
    .insert({
      squad_id: raw.squad_id,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      date_of_birth: input.date_of_birth,
      parent_guardian_name: input.parent_guardian_name.trim(),
      parent_contact_email: input.parent_contact_email.trim(),
      parent_contact_phone: input.parent_contact_phone,
      medical_notes: input.medical_notes,
      consent_given: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to add player' }, { status: 500 })

  return NextResponse.json({ player: data }, { status: 201 })
}
