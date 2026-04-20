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

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  // Create broadcast room
  const { data: room, error } = await admin
    .from('chat_rooms')
    .insert({ kind: 'broadcast', name: name.trim(), created_by: user.id })
    .select('id')
    .single()
  if (error || !room) return NextResponse.json({ error: error?.message ?? 'Failed to create room' }, { status: 500 })

  // Add all users as members
  const { data: allUsers } = await admin.from('users').select('id, role')
  const members = (allUsers ?? []).map(u => ({
    room_id: room.id,
    user_id: u.id,
    role: ['admin', 'coach', 'teacher'].includes(u.role) ? 'owner' : 'member',
  }))
  await admin.from('chat_members').insert(members)

  return NextResponse.json({ roomId: room.id })
}
