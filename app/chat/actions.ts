'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/** Find or create a 1-to-1 DM room between the current user and another user. */
export async function getOrCreateDM(otherUserId: string): Promise<string | { error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  if (user.id === otherUserId) return { error: 'Cannot DM yourself' }

  const admin = createAdminClient()

  // Find existing DM with exactly these two members
  const { data: existingRooms } = await admin
    .from('chat_members')
    .select('room_id, chat_rooms!inner(kind)')
    .eq('user_id', user.id)
  const myRoomIds = (existingRooms ?? []).filter((r: any) => r.chat_rooms?.kind === 'dm').map((r: any) => r.room_id)

  if (myRoomIds.length > 0) {
    const { data: shared } = await admin
      .from('chat_members')
      .select('room_id')
      .eq('user_id', otherUserId)
      .in('room_id', myRoomIds)
    if (shared && shared.length > 0) return shared[0].room_id
  }

  // Create new DM
  const { data: room, error } = await admin
    .from('chat_rooms')
    .insert({ kind: 'dm', created_by: user.id })
    .select('id')
    .single()
  if (error || !room) return { error: error?.message ?? 'Could not create room' }

  await admin.from('chat_members').insert([
    { room_id: room.id, user_id: user.id,       role: 'owner' },
    { room_id: room.id, user_id: otherUserId,   role: 'member' },
  ])

  revalidatePath('/chat')
  return room.id
}

const BOT_USER_ID = '00000000-0000-0000-0000-000000000099'

/** Find or create the user's personal AI Coach bot room */
export async function getOrCreateBotRoom(): Promise<string | { error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()

  // Find existing bot room for this user
  const { data: existing } = await admin
    .from('chat_members')
    .select('room_id, chat_rooms!inner(kind)')
    .eq('user_id', user.id)
  const botRoom = (existing ?? []).find((r: any) => r.chat_rooms?.kind === 'bot')
  if (botRoom) return botRoom.room_id

  // Create new bot room
  const { data: room, error } = await admin
    .from('chat_rooms')
    .insert({ kind: 'bot', name: 'AI Coach', created_by: user.id })
    .select('id')
    .single()
  if (error || !room) return { error: error?.message ?? 'Could not create bot room' }

  await admin.from('chat_members').insert([
    { room_id: room.id, user_id: user.id,    role: 'member' },
    { room_id: room.id, user_id: BOT_USER_ID, role: 'member' },
  ])

  revalidatePath('/chat')
  return room.id
}

/** Mark the room as read for the current user */
export async function markRead(roomId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const admin = createAdminClient()
  await admin.from('chat_members').update({ last_read_at: new Date().toISOString() })
    .eq('room_id', roomId).eq('user_id', user.id)
}
