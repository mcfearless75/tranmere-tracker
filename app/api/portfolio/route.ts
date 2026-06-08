import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidEntryType } from '@/lib/portfolio/portfolioUtils'
import type { EntryType } from '@/lib/portfolio/portfolioUtils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const typeParam = searchParams.get('type')

  let query = supabase
    .from('portfolio_entries')
    .select('*')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  if (typeParam !== null) {
    if (!isValidEntryType(typeParam)) {
      return NextResponse.json({ error: 'Invalid entry_type filter' }, { status: 400 })
    }
    query = query.eq('entry_type', typeParam as EntryType)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    title?: string
    description?: string
    entry_type?: string
    tags?: string[]
    media_url?: string
  }

  const { title, description, entry_type, tags, media_url } = body

  if (!title || title.trim() === '') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const resolvedType = entry_type ?? 'achievement'
  if (!isValidEntryType(resolvedType)) {
    return NextResponse.json(
      { error: `entry_type must be one of: achievement, reflection, goal, evidence` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('portfolio_entries')
    .insert({
      student_id: user.id,
      title: title.trim(),
      description: description ?? null,
      entry_type: resolvedType,
      tags: tags ?? [],
      media_url: media_url ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
