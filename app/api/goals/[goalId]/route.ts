import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoalCategory, GoalPriority, GoalStatus } from '@/lib/goals/goalsUtils'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { goalId } = params

  // Verify ownership
  const { data: existing } = await supabase
    .from('student_goals')
    .select('id, status')
    .eq('id', goalId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  const body = await request.json() as {
    title?: string
    description?: string
    category?: GoalCategory
    deadline?: string | null
    priority?: GoalPriority
    status?: GoalStatus
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.title !== undefined) updates.title = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.category !== undefined) updates.category = body.category
  if (body.deadline !== undefined) updates.deadline = body.deadline
  if (body.priority !== undefined) updates.priority = body.priority
  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'completed') {
      updates.completed_at = new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from('student_goals')
    .update(updates)
    .eq('id', goalId)
    .eq('student_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ goal: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { goalId } = params

  const { error } = await supabase
    .from('student_goals')
    .delete()
    .eq('id', goalId)
    .eq('student_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
