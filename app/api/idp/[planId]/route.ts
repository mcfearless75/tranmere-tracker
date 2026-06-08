import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { IdpStatus } from '@/lib/idp/idpUtils'

export const dynamic = 'force-dynamic'

interface PatchIdpBody {
  title?: string
  description?: string | null
  target_date?: string | null
  status?: IdpStatus
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { planId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { planId } = params
  const body = await request.json() as PatchIdpBody
  const { title, description, target_date, status } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    }
    updates.title = title.trim()
  }
  if (description !== undefined) updates.description = description
  if (target_date !== undefined) updates.target_date = target_date
  if (status !== undefined) {
    const valid: IdpStatus[] = ['active', 'completed', 'paused']
    if (!valid.includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }
    updates.status = status
  }

  const { data, error } = await supabase
    .from('idp_plans')
    .update(updates)
    .eq('id', planId)
    .eq('student_id', user.id)
    .select('*')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  return NextResponse.json({ success: true, plan: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { planId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { planId } = params

  const { error } = await supabase
    .from('idp_plans')
    .delete()
    .eq('id', planId)
    .eq('student_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
