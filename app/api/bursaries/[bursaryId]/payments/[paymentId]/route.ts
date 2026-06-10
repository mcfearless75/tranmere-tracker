import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPaymentStatus } from '@/lib/bursaries/bursaryUtils'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { bursaryId: string; paymentId: string } },
) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { status, note } = (body ?? {}) as Record<string, unknown>

  if (!isPaymentStatus(status)) {
    return NextResponse.json({ error: 'status is invalid' }, { status: 400 })
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return NextResponse.json({ error: 'note is invalid' }, { status: 400 })
  }

  const updates: Record<string, string | null> = { status }
  if (status === 'pending') {
    // Reverting to pending clears the audit fields.
    updates.paid_at = null
    updates.marked_by = null
  } else {
    updates.paid_at = status === 'paid' ? new Date().toISOString() : null
    updates.marked_by = userId
  }
  if (typeof note === 'string') {
    updates.note = note.trim() !== '' ? note.trim() : null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bursary_payments')
    .update(updates)
    .eq('id', params.paymentId)
    .eq('bursary_id', params.bursaryId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  return NextResponse.json({ payment: data })
}
