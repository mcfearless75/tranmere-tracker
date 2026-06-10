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
  { params }: { params: { prospectId: string } },
) {
  const userId = await requireStaff()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { note } = (body ?? {}) as Record<string, unknown>

  if (typeof note !== 'string' || note.trim() === '') {
    return NextResponse.json({ error: 'note is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Confirm the prospect exists before attaching a note.
  const { data: prospect, error: prospectError } = await admin
    .from('recruitment_prospects')
    .select('id')
    .eq('id', params.prospectId)
    .maybeSingle()

  if (prospectError) return NextResponse.json({ error: prospectError.message }, { status: 500 })
  if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })

  const { data, error } = await admin
    .from('prospect_notes')
    .insert({
      prospect_id: params.prospectId,
      author_id: userId,
      note: note.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ note: data }, { status: 201 })
}
