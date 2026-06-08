import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isConcernCategory,
  isConcernSeverity,
  isConcernStatus,
} from '@/lib/safeguarding/safeguardingUtils'

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

export async function GET(
  _request: NextRequest,
  { params }: { params: { concernId: string } },
) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: concern, error: concernError } = await admin
    .from('safeguarding_concerns')
    .select('*')
    .eq('id', params.concernId)
    .maybeSingle()

  if (concernError) return NextResponse.json({ error: concernError.message }, { status: 500 })
  if (!concern) return NextResponse.json({ error: 'Concern not found' }, { status: 404 })

  const { data: notes, error: notesError } = await admin
    .from('safeguarding_notes')
    .select('*')
    .eq('concern_id', params.concernId)
    .order('created_at', { ascending: true })

  if (notesError) return NextResponse.json({ error: notesError.message }, { status: 500 })

  return NextResponse.json({ concern, notes: notes ?? [] })
}

export async function PATCH(
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

  const { status, severity, category } = (body ?? {}) as Record<string, unknown>

  const updates: Record<string, string> = {}

  if (status !== undefined) {
    if (!isConcernStatus(status)) {
      return NextResponse.json({ error: 'status is invalid' }, { status: 400 })
    }
    updates.status = status
  }
  if (severity !== undefined) {
    if (!isConcernSeverity(severity)) {
      return NextResponse.json({ error: 'severity is invalid' }, { status: 400 })
    }
    updates.severity = severity
  }
  if (category !== undefined) {
    if (!isConcernCategory(category)) {
      return NextResponse.json({ error: 'category is invalid' }, { status: 400 })
    }
    updates.category = category
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('safeguarding_concerns')
    .update(updates)
    .eq('id', params.concernId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Concern not found' }, { status: 404 })

  return NextResponse.json({ concern: data })
}
