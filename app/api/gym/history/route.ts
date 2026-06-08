import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPersonalBests } from '@/lib/gym/gymUtils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceDate = since.toISOString().split('T')[0]

  const { data: logs, error } = await supabase
    .from('gym_logs')
    .select('*')
    .eq('student_id', user.id)
    .gte('logged_date', sinceDate)
    .order('logged_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pbs = getPersonalBests(logs ?? [])

  return NextResponse.json({ logs: logs ?? [], personalBests: pbs })
}
