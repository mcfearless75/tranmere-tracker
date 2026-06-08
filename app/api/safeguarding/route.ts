import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isConcernCategory,
  isConcernSeverity,
  isConcernStatus,
} from '@/lib/safeguarding/safeguardingUtils'

export const dynamic = 'force-dynamic'

/** Verifies the requester is an authenticated admin. Returns the user id or null. */
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

export async function GET(request: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')
  const severityFilter = searchParams.get('severity')

  const admin = createAdminClient()
  let query = admin
    .from('safeguarding_concerns')
    .select('*')
    .order('created_at', { ascending: false })

  if (statusFilter && isConcernStatus(statusFilter)) {
    query = query.eq('status', statusFilter)
  }
  if (severityFilter && isConcernSeverity(severityFilter)) {
    query = query.eq('severity', severityFilter)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ concerns: data ?? [] })
}

export async function POST(request: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    student_id: studentId,
    category,
    severity,
    description,
    status,
  } = (body ?? {}) as Record<string, unknown>

  if (!studentId || typeof studentId !== 'string') {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 })
  }
  if (!isConcernCategory(category)) {
    return NextResponse.json({ error: 'category is invalid' }, { status: 400 })
  }
  if (!isConcernSeverity(severity)) {
    return NextResponse.json({ error: 'severity is invalid' }, { status: 400 })
  }
  if (typeof description !== 'string' || description.trim() === '') {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }
  if (status !== undefined && !isConcernStatus(status)) {
    return NextResponse.json({ error: 'status is invalid' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('safeguarding_concerns')
    .insert({
      student_id: studentId,
      raised_by: userId,
      category,
      severity,
      description: description.trim(),
      status: status ?? 'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ concern: data }, { status: 201 })
}
