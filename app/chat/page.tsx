import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { MessageSquare, Plus } from 'lucide-react'
import { NewDmPicker } from './NewDmPicker'
import { NewGroupPicker } from './NewGroupPicker'
import { AiCoachButton } from './AiCoachButton'
import { ChatRoomList, type ChatListRoom } from '@/components/chat/ChatRoomList'
import { PushOptIn } from '@/components/PushOptIn'

export const dynamic = 'force-dynamic'

export default async function ChatHubPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Check migration has run
  let migrationNeeded = false
  const { data: myMemberships, error } = await admin
    .from('chat_members')
    .select('room_id, last_read_at, chat_rooms(id, kind, name, match_id, last_message_at, created_by, sync_year_group, sync_team_id)')
    .eq('user_id', user.id)
    .order('chat_rooms(last_message_at)', { ascending: false } as any)

  if (error) {
    const msg = String(error.message ?? error)
    if (msg.includes('chat_') || msg.includes('does not exist') || msg.includes('schema')) {
      migrationNeeded = true
    }
  }

  if (migrationNeeded) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold text-tranmere-blue">Chat</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-semibold text-amber-800">⚠️ Database migration needed</p>
          <p className="text-sm text-amber-700 mt-2">
            Run the latest migration in <code className="bg-amber-100 px-1.5 py-0.5 rounded">supabase/migrations/</code> in Supabase SQL Editor, then refresh.
          </p>
        </div>
      </div>
    )
  }

  const roomIds = (myMemberships ?? []).map((m: any) => m.chat_rooms?.id).filter(Boolean) as string[]

  // For each room, compute unread count + other member (for DMs) + last message preview
  const [{ data: allMembers }, { data: allUsers }, { data: lastMsgs }] = await Promise.all([
    admin.from('chat_members').select('room_id, user_id').in('room_id', roomIds.length ? roomIds : ['00000000-0000-0000-0000-000000000000']),
    admin.from('users').select('id, name, avatar_url, role'),
    admin.from('chat_messages').select('room_id, body, created_at, sender_id').in('room_id', roomIds.length ? roomIds : ['00000000-0000-0000-0000-000000000000']).order('created_at', { ascending: false }),
  ])

  const usersById: Record<string, any> = {}
  for (const u of allUsers ?? []) usersById[u.id] = u

  const lastMsgByRoom: Record<string, any> = {}
  for (const m of lastMsgs ?? []) if (!lastMsgByRoom[m.room_id]) lastMsgByRoom[m.room_id] = m

  const unreadByRoom: Record<string, number> = {}
  for (const rId of roomIds) {
    const lastRead = (myMemberships ?? []).find((m: any) => m.room_id === rId)?.last_read_at
    const count = (lastMsgs ?? []).filter(m => m.room_id === rId && m.sender_id !== user.id && (!lastRead || new Date(m.created_at) > new Date(lastRead))).length
    unreadByRoom[rId] = count
  }

  const rooms = (myMemberships ?? [])
    .map((m: any) => {
      const room = m.chat_rooms
      if (!room) return null
      const members = (allMembers ?? []).filter(am => am.room_id === room.id)
      const otherMemberId = room.kind === 'dm' ? members.find(am => am.user_id !== user.id)?.user_id : null
      const other = otherMemberId ? usersById[otherMemberId] : null
      const label = room.kind === 'dm'
        ? (other?.name ?? 'Unknown')
        : (room.name ?? (room.kind === 'squad' ? 'Squad chat' : 'Chat room'))
      const last = lastMsgByRoom[room.id]
      return {
        id: room.id,
        kind: room.kind,
        label,
        otherUserId: otherMemberId ?? null,
        avatarUrl: other?.avatar_url ?? null,
        // Group rooms only — lets search find "the squad chats Lewis is in".
        memberNames: room.kind === 'dm' ? [] : members
          .filter(am => am.user_id !== user.id)
          .map(am => usersById[am.user_id]?.name)
          .filter((n: string | null | undefined): n is string => !!n),
        lastMessage: last?.body ?? null,
        lastAt: room.last_message_at,
        unread: unreadByRoom[room.id] ?? 0,
        isOwner: room.created_by === user.id,
        syncYearGroup: room.sync_year_group ?? null,
        syncTeamId: room.sync_team_id ?? null,
      }
    })
    .filter(Boolean) as any[]

  // Check role to filter who can start new DMs with everyone
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).single()
  const isStaff = me && ['admin','coach','teacher'].includes(me.role)

  // Load directory of people you could DM
  const { data: directory } = isStaff
    ? await admin.from('users').select('id, name, role, avatar_url').neq('id', user.id).order('name')
    : await admin.from('users').select('id, name, role, avatar_url').neq('id', user.id).in('role', ['coach','teacher','admin','student']).order('name')

  // Group chat membership excludes parents — they use the parent portal instead.
  const { data: groupDirectory } = isStaff
    ? await admin.from('users').select('id, name, role, avatar_url').neq('id', user.id).neq('role', 'parent').order('name')
    : { data: [] as { id: string; name: string | null; role: string; avatar_url: string | null }[] }

  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-8 pb-24 md:pb-8 space-y-3">
      {/* Chat is where missed alerts hurt most — prompt here, not just on the dashboard */}
      <PushOptIn hideWhenEnabled />
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue flex items-center gap-1.5">
          <MessageSquare size={22} /> Chat
        </h1>
      </div>

      <AiCoachButton />
      <NewDmPicker directory={directory ?? []} />
      {isStaff && <NewGroupPicker directory={groupDirectory ?? []} />}

      {rooms.length === 0 && (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">
          No conversations yet. Tap <Plus size={12} className="inline" /> above to start one.
        </div>
      )}

      <ChatRoomList rooms={rooms as ChatListRoom[]} directory={directory ?? []} />
    </div>
  )
}
