import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { UsersRound } from 'lucide-react'
import { ChatGroupCard } from './ChatGroupCard'

export const dynamic = 'force-dynamic'

// Manually-managed group chats only ('custom') — not broadcast channels
// (auto-populated from the whole squad, managed on /admin/broadcast), not
// DMs, not the AI Coach bot room. This is specifically for chats like
// "Year 1 Students" / "Year 2 Students" where staff need to be added
// individually, and where the normal per-room chat screen hides the
// add/remove controls entirely once a room has an auto-synced student
// roster (sync_year_group set) — even though staff-only membership changes
// are safe there and already supported server-side.
export default async function ChatGroupsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const { data: rooms } = await admin
    .from('chat_rooms')
    .select('id, name, sync_year_group, created_at')
    .eq('kind', 'custom')
    .order('name')

  const roomIds = (rooms ?? []).map(r => r.id)

  const { data: memberRows } = roomIds.length
    ? await admin
        .from('chat_members')
        .select('room_id, user_id, users:user_id(id, name, role)')
        .in('room_id', roomIds)
    : { data: [] }

  // Everyone who could conceivably be added to a group chat. Parents never
  // join group chats (matches createGroupChat/addGroupMembers server-side).
  // Deactivated/departed accounts are excluded — same reasoning as every
  // other current-roster picker in the app.
  const { data: everyone } = await admin
    .from('users')
    .select('id, name, role')
    .neq('role', 'parent')
    .eq('is_active', true)
    .order('name')

  const membersByRoom = new Map<string, { id: string; name: string | null; role: string }[]>()
  for (const row of memberRows ?? []) {
    const person = (row as any).users as { id: string; name: string | null; role: string } | null
    if (!person) continue
    const list = membersByRoom.get(row.room_id) ?? []
    list.push(person)
    membersByRoom.set(row.room_id, list)
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <UsersRound size={22} className="text-tranmere-blue" />
        <h1 className="text-xl font-bold text-tranmere-blue">Chat Group Membership</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        Add or remove staff and students from group chats. You don&apos;t need to already be
        a member of a chat to manage it from here.
      </p>

      <div className="space-y-3">
        {(rooms ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No group chats yet.</p>
        )}
        {(rooms ?? []).map(room => {
          const members = membersByRoom.get(room.id) ?? []
          const memberIds = new Set(members.map(m => m.id))
          // On an auto-synced roster (sync_year_group set), the student list
          // is trigger-managed — only offer staff as addable there, so
          // there's no confusing "nothing happened" when the server
          // (correctly) filters a student pick back out.
          const addable = (everyone ?? []).filter(c =>
            !memberIds.has(c.id) && (!room.sync_year_group || c.role !== 'student')
          )

          return (
            <ChatGroupCard
              key={room.id}
              roomId={room.id}
              roomName={room.name ?? 'Group chat'}
              syncYearGroup={room.sync_year_group}
              members={members}
              addable={addable}
            />
          )
        })}
      </div>
    </div>
  )
}
