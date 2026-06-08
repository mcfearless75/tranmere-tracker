import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidEntryType } from '@/lib/portfolio/portfolioUtils'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { entryId: string } }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entryId } = params

  // Confirm ownership
  const { data: existing } = await supabase
    .from('portfolio_entries')
    .select('id')
    .eq('id', entryId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  const body = await request.json() as {
    title?: string
    description?: string
    entry_type?: string
    tags?: string[]
    media_url?: string
  }

  if (body.title !== undefined && body.title.trim() === '') {
    return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
  }

  if (body.entry_type !== undefined && !isValidEntryType(body.entry_type)) {
    return NextResponse.json(
      { error: 'entry_type must be one of: achievement, reflection, goal, evidence' },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {}
  if (body.title !== undefined) updates.title = body.title.trim()
  if (body.description !== undefined) updates.description = body.description
  if (body.entry_type !== undefined) updates.entry_type = body.entry_type
  if (body.tags !== undefined) updates.tags = body.tags
  if (body.media_url !== undefined) updates.media_url = body.media_url

  const { data, error } = await supabase
    .from('portfolio_entries')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entryId } = params

  const { data: existing } = await supabase
    .from('portfolio_entries')
    .select('id')
    .eq('id', entryId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('portfolio_entries')
    .delete()
    .eq('id', entryId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
