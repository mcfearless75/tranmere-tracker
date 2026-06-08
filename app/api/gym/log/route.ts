import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface LogBody {
  exercise: string
  sets?: number | null
  reps?: number | null
  weight_kg?: number | null
  notes?: string | null
  logged_date?: string
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as LogBody
  const { exercise, sets, reps, weight_kg, notes, logged_date } = body

  if (!exercise || typeof exercise !== 'string' || exercise.trim() === '') {
    return NextResponse.json({ error: 'exercise is required' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('gym_logs')
    .insert({
      student_id: user.id,
      exercise: exercise.trim(),
      sets: sets ?? null,
      reps: reps ?? null,
      weight_kg: weight_kg ?? null,
      notes: notes ?? null,
      logged_date: logged_date ?? today,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, log: data })
}
