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
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Can't delete yourself
  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  // Delete from auth (cascade removes public.users via FK on delete cascade)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Belt & braces — delete public.users row explicitly
  await admin.from('users').delete().eq('id', userId)

  return NextResponse.json({ success: true, message: 'User deleted.' })
}
