import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { amount_ml: unknown }
  const amount_ml = body.amount_ml

  if (typeof amount_ml !== 'number' || !Number.isInteger(amount_ml) || amount_ml <= 0) {
    return NextResponse.json({ error: 'amount_ml must be a positive integer' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('hydration_logs')
    .insert({ student_id: user.id, amount_ml, logged_date: today })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
