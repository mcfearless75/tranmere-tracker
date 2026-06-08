import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoalCategory, GoalPriority } from '@/lib/goals/goalsUtils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  let query = supabase
    .from('student_goals')
    .select('*')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ goals: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    title?: string
    description?: string
    category?: GoalCategory
    deadline?: string
    priority?: GoalPriority
  }

  const { title, description, category, deadline, priority } = body

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const validCategories: GoalCategory[] = ['personal', 'academic', 'football', 'fitness']
  if (!category || !validCategories.includes(category)) {
    return NextResponse.json({ error: 'category is required and must be one of: personal, academic, football, fitness' }, { status: 400 })
  }

  const validPriorities: GoalPriority[] = ['low', 'medium', 'high']
  if (!priority || !validPriorities.includes(priority)) {
    return NextResponse.json({ error: 'priority is required and must be one of: low, medium, high' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('student_goals')
    .insert({
      student_id: user.id,
      title: title.trim(),
      description: description ?? null,
      category,
      deadline: deadline ?? null,
      priority,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ goal: data }, { status: 201 })
}
