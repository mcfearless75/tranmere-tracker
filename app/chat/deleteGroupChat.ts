'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/** Permanently delete a custom group chat. Staff-only. Messages and members
 *  cascade from chat_rooms. Refuses DMs / broadcasts / bot rooms. */
export async function deleteGroupChat(roomId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['admin', 'coach', 'teacher'].includes(me.role)) {
    return { ok: false, error: 'Staff only' }
  }

  const { data: room } = await admin
    .from('chat_rooms')
    .select('id, kind')
    .eq('id', roomId)
    .maybeSingle()

  if (!room) return { ok: false, error: 'Group not found' }
  if (room.kind !== 'custom') return { ok: false, error: 'Only group chats can be deleted here' }

  const { error } = await admin.from('chat_rooms').delete().eq('id', roomId).eq('kind', 'custom')
  if (error) return { ok: false, error: error.message }

  revalidatePath('/chat')
  revalidatePath('/admin/chat-groups')
  revalidatePath(`/chat/${roomId}`)
  return { ok: true }
}
