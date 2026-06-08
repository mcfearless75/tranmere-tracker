import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function requireAdmin(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') return null
  return user.id
}

export async function POST(
  request: NextRequest,
  { params }: { params: { concernId: string } },
) {
  const userId = await requireAdmin()
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

  // Confirm the concern exists before attaching a note.
  const { data: concern, error: concernError } = await admin
    .from('safeguarding_concerns')
    .select('id')
    .eq('id', params.concernId)
    .maybeSingle()

  if (concernError) return NextResponse.json({ error: concernError.message }, { status: 500 })
  if (!concern) return NextResponse.json({ error: 'Concern not found' }, { status: 404 })

  const { data, error } = await admin
    .from('safeguarding_notes')
    .insert({
      concern_id: params.concernId,
      author_id: userId,
      note: note.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ note: data }, { status: 201 })
}
