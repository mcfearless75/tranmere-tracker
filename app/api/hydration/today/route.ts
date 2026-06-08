import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('hydration_logs')
    .select('amount_ml')
    .eq('student_id', user.id)
    .eq('logged_date', today)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total_ml = (data ?? []).reduce((sum, row) => sum + row.amount_ml, 0)

  return NextResponse.json({ total_ml })
}
