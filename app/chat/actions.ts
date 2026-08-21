'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendPushNotification } from '@/lib/webpush'
import type { SupabaseClient } from '@supabase/supabase-js'

/** True if userId is a member of roomId. Guards actions that touch a room. */
async function isRoomMember(admin: SupabaseClient, roomId: string, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('chat_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

/** True if the room's membership is auto-derived from year_group (not manually editable). */
async function isSyncedRoom(admin: SupabaseClient, roomId: string): Promise<boolean> {
  const { data } = await admin
    .from('chat_rooms')
    .select('sync_year_group')
    .eq('id', roomId)
    .maybeSingle()
  return !!data?.sync_year_group
}

/** Create a new named group chat. Staff-only (admin/coach/teacher). */
export async function createGroupChat(name: string, memberIds: string[]): Promise<string | { error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['admin', 'coach', 'teacher'].includes(me.role)) return { error: 'Staff only' }

  const trimmedName = name.trim()
  if (!trimmedName) return { error: 'Group needs a name' }

  const uniqueMemberIds = Array.from(new Set(memberIds.filter(id => id !== user.id)))
  if (uniqueMemberIds.length === 0) return { error: 'Pick at least one member' }

  const { data: room, error } = await admin
    .from('chat_rooms')
    .insert({ kind: 'custom', name: trimmedName, created_by: user.id })
    .select('id')
    .single()
  if (error || !room) return { error: error?.message ?? 'Could not create group' }

  const rows = [
    { room_id: room.id, user_id: user.id, role: 'owner' },
    ...uniqueMemberIds.map(id => ({ room_id: room.id, user_id: id, role: 'member' })),
  ]
  await admin.from('chat_members').insert(rows)

  revalidatePath('/chat')
  return room.id
}

/** Add one or more people to an existing group chat. Staff-only, blocked for auto-synced rooms. */
export async function addGroupMembers(roomId: string, memberIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['admin', 'coach', 'teacher'].includes(me.role)) return { ok: false, error: 'Staff only' }

  if (await isSyncedRoom(admin, roomId)) return { ok: false, error: 'This roster is managed automatically' }

  const uniqueMemberIds = Array.from(new Set(memberIds))
  if (uniqueMemberIds.length === 0) return { ok: false, error: 'Pick at least one member' }

  const rows = uniqueMemberIds.map(id => ({ room_id: roomId, user_id: id, role: 'member' }))
  const { error } = await admin.from('chat_members').upsert(rows, { onConflict: 'room_id,user_id', ignoreDuplicates: true })
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/chat/${roomId}`)
  return { ok: true }
}

/** Remove one person from a group chat. Staff-only, blocked for auto-synced rooms. */
export async function removeGroupMember(roomId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['admin', 'coach', 'teacher'].includes(me.role)) return { ok: false, error: 'Staff only' }

  if (await isSyncedRoom(admin, roomId)) return { ok: false, error: 'This roster is managed automatically' }

  const { error } = await admin.from('chat_members').delete().eq('room_id', roomId).eq('user_id', userId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/chat/${roomId}`)
  return { ok: true }
}

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

/** Fire a push notification to other room members when a new message arrives */
export async function notifyRoomMembers(
  roomId: string,
  _senderName: string,
  preview: string,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()

  // Caller must belong to the room they are notifying — prevents push spoofing
  // to arbitrary rooms/users.
  if (!await isRoomMember(admin, roomId, user.id)) return

  const { data: members } = await admin
    .from('chat_members')
    .select('user_id')
    .eq('room_id', roomId)
    .neq('user_id', user.id)

  if (!members || members.length === 0) return

  // Derive the sender name server-side; never trust the caller-supplied name.
  const { data: sender } = await admin.from('users').select('name').eq('id', user.id).maybeSingle()
  const senderName = sender?.name ?? 'Someone'

  const otherIds = members.map(m => m.user_id)
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', otherIds)

  if (!subs || subs.length === 0) return

  await Promise.allSettled(
    subs.map(s => sendPushNotification(
      { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
      { title: senderName, body: preview.slice(0, 100), url: `/chat/${roomId}` }
    ))
  )
}

/** Send a push nudge to all other members of a room */
export async function nudgeRoom(roomId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()

  // Caller must belong to the room they are nudging.
  if (!await isRoomMember(admin, roomId, user.id)) return { ok: false, error: 'Not a member of this room' }

  // Get room label and all other members
  const [{ data: room }, { data: members }, { data: sender }] = await Promise.all([
    admin.from('chat_rooms').select('name, kind').eq('id', roomId).single(),
    admin.from('chat_members').select('user_id').eq('room_id', roomId).neq('user_id', user.id),
    admin.from('users').select('name').eq('id', user.id).single(),
  ])

  if (!members || members.length === 0) return { ok: false, error: 'No other members' }

  const senderName = sender?.name ?? 'Someone'
  const roomName = room?.name ?? (room?.kind === 'dm' ? 'a DM' : 'the chat')
  const title = `${senderName} nudged you`
  const body = `You have unread messages in ${roomName}`

  // Get push subscriptions for all other members
  const otherIds = members.map(m => m.user_id)
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', otherIds)

  if (!subs || subs.length === 0) return { ok: true }

  await Promise.allSettled(
    subs.map(s => sendPushNotification(
      { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
      { title, body, url: `/chat/${roomId}` }
    ))
  )

  return { ok: true }
}

/** Leave a room (or delete it if the current user is the only member / owner of a non-DM) */
export async function leaveOrDeleteRoom(roomId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()

  // Caller must belong to the room before any destructive action.
  if (!await isRoomMember(admin, roomId, user.id)) return { ok: false, error: 'Not a member of this room' }

  const { data: room } = await admin.from('chat_rooms').select('kind, created_by, sync_year_group').eq('id', roomId).single()
  const { data: members } = await admin.from('chat_members').select('user_id').eq('room_id', roomId)

  if (!room) return { ok: false, error: 'Room not found' }
  if (room.sync_year_group) return { ok: false, error: "You can't leave this — ask a coach if this looks wrong" }

  const isOwner = room.created_by === user.id
  const memberCount = members?.length ?? 0

  // Delete entire room if: last member, OR owner of a DM/bot room with only one other person
  const shouldDelete = memberCount <= 1 || (isOwner && ['dm', 'bot'].includes(room.kind))

  if (shouldDelete) {
    // Cascade: delete messages and members first, then room
    await admin.from('chat_messages').delete().eq('room_id', roomId)
    await admin.from('chat_members').delete().eq('room_id', roomId)
    await admin.from('chat_rooms').delete().eq('id', roomId)
  } else {
    // Just remove self from the room
    await admin.from('chat_members').delete().eq('room_id', roomId).eq('user_id', user.id)
  }

  revalidatePath('/chat')
  return { ok: true }
}
