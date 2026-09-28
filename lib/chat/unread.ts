/**
 * Unread chat summary for the app-wide new-message banner and the Chat nav
 * badge. Added 2026-09-28: Android native push is disabled (see
 * components/PushOptIn.tsx), so Android users got no alert at all for a new
 * message unless they were already inside that chat.
 *
 * "Unread" matches app/chat/page.tsx: messages from someone else, newer than
 * the member's chat_members.last_read_at (bumped by markRead when a room is
 * opened). Deleted messages are left out.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type UnreadLatest = {
  id: string
  roomId: string
  roomLabel: string
  senderName: string
  preview: string
  createdAt: string
}

export type UnreadSummary = { total: number; latest: UnreadLatest | null }

type MessageRow = {
  id: string
  room_id: string
  sender_id: string
  body: string | null
  attachment_kind: string | null
  poll_id: string | null
  created_at: string
}

type Membership = {
  room_id: string
  last_read_at: string | null
  chat_rooms: { id: string; kind: string; name: string | null; last_message_at: string | null } | null
}

export const PREVIEW_MAX = 90

export function messagePreview(m: Pick<MessageRow, 'body' | 'attachment_kind' | 'poll_id'>): string {
  if (m.poll_id) return '📊 Poll'
  const body = (m.body ?? '').replace(/\s+/g, ' ').trim()
  if (body) return body.length > PREVIEW_MAX ? body.slice(0, PREVIEW_MAX - 1) + '…' : body
  if (m.attachment_kind === 'image') return '📷 Photo'
  if (m.attachment_kind) return '📎 Attachment'
  return 'New message'
}

/** Rooms that could have unread messages: activity since the member last read, and not the room on screen. */
export function roomsWithActivity(memberships: Membership[], viewingRoomId: string | null): Membership[] {
  return memberships.filter(m => {
    if (!m.chat_rooms || m.room_id === viewingRoomId) return false
    if (!m.last_read_at) return true
    return !!m.chat_rooms.last_message_at && m.chat_rooms.last_message_at > m.last_read_at
  })
}

const EPOCH = '1970-01-01T00:00:00Z'

/**
 * Needs the service-role client for sender names and DM labels (a student
 * cannot read every user row). Every query is scoped to the caller's own
 * memberships, so nothing outside their rooms is returned.
 */
export async function getUnreadSummary(
  admin: SupabaseClient,
  userId: string,
  viewingRoomId: string | null,
): Promise<UnreadSummary> {
  const { data, error } = await admin
    .from('chat_members')
    .select('room_id, last_read_at, chat_rooms(id, kind, name, last_message_at)')
    .eq('user_id', userId)
  if (error) throw error

  const active = roomsWithActivity((data ?? []) as unknown as Membership[], viewingRoomId)
  if (active.length === 0) return { total: 0, latest: null }

  const perRoom = await Promise.all(active.map(async m => {
    const res = await admin
      .from('chat_messages')
      .select('id, room_id, sender_id, body, attachment_kind, poll_id, created_at', { count: 'exact' })
      .eq('room_id', m.room_id)
      .gt('created_at', m.last_read_at ?? EPOCH)
      .neq('sender_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
    if (res.error) throw res.error
    return { membership: m, count: res.count ?? 0, newest: (res.data?.[0] ?? null) as MessageRow | null }
  }))

  const total = perRoom.reduce((n, r) => n + r.count, 0)
  const top = perRoom
    .filter(r => r.newest)
    .sort((a, b) => b.newest!.created_at.localeCompare(a.newest!.created_at))[0]
  if (!top) return { total, latest: null }

  const msg = top.newest!
  const room = top.membership.chat_rooms!
  const [{ data: sender }, dmOther] = await Promise.all([
    admin.from('users').select('name').eq('id', msg.sender_id).maybeSingle(),
    room.kind === 'dm'
      ? admin.from('chat_members').select('users(name)').eq('room_id', room.id).neq('user_id', userId).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const senderName = (sender as { name?: string } | null)?.name ?? 'Someone'
  const dmName = (dmOther.data as { users?: { name?: string } | null } | null)?.users?.name
  const roomLabel = room.kind === 'dm'
    ? (dmName ?? senderName)
    : (room.name ?? (room.kind === 'squad' ? 'Squad chat' : 'Chat room'))

  return {
    total,
    latest: {
      id: msg.id,
      roomId: room.id,
      roomLabel,
      senderName,
      preview: messagePreview(msg),
      createdAt: msg.created_at,
    },
  }
}
