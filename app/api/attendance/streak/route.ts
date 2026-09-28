import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStudentStreak } from '@/lib/attendance/streak'
import { londonDateISO } from '@/lib/dates'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** The signed-in student's own check-in streak (shown on the scan success screen). */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 })

  try {
    const streak = await getStudentStreak(createAdminClient(), user.id, londonDateISO())
    return NextResponse.json({ ok: true, streak })
  } catch (err) {
    console.error('streak lookup failed:', err)
    return NextResponse.json({ ok: false, error: 'Could not load streak' }, { status: 500 })
  }
}
