import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, newPin } = await request.json()
  if (!userId || !newPin) {
    return NextResponse.json({ error: 'userId and newPin required' }, { status: 400 })
  }
  if (!/^\d{5,6}$/.test(newPin)) {
    return NextResponse.json({ error: 'PIN must be 5 or 6 digits' }, { status: 400 })
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPin })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, message: `PIN reset. They can now sign in with PIN ${newPin}.` })
}
