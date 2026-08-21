import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ChatThread } from './ChatThread'
import { GroupMembers } from './GroupMembers'
import { AddGroupMembers } from './AddGroupMembers'

export const dynamic = 'force-dynamic'

export default async function ChatRoomPage({ params }: { params: { roomId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: room } = await admin.from('chat_rooms').select('*').eq('id', params.roomId).single()
  if (!room) notFound()

  const { data: members } = await admin
    .from('chat_members')
    .select('user_id, role, users:user_id(id, name, avatar_url, role)')
    .eq('room_id', params.roomId)

  const me = (members ?? []).find((m: any) => m.user_id === user.id)
  const isStaff = me && ['admin', 'coach', 'teacher'].includes((me as any).users?.role ?? '')
  const canSend = room.kind !== 'broadcast' || !!isStaff
  if (!me) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">You&apos;re not a member of this conversation.</p>
        <Link href="/chat" className="text-tranmere-blue underline mt-2 inline-block">Back</Link>
      </div>
    )
  }

  const isGroupRoom = room.kind === 'custom'

  // For staff on a manually-managed group, load who could still be added —
  // everyone except parents and everyone already a member.
  let addable: { id: string; name: string | null; role: string }[] = []
  if (isGroupRoom && isStaff && !room.sync_year_group) {
    const memberIds = (members ?? []).map((m: any) => m.user_id)
    const { data: candidates } = await admin
      .from('users')
      .select('id, name, role')
      .neq('role', 'parent')
      .order('name')
    addable = (candidates ?? []).filter(c => !memberIds.includes(c.id))
  }

  // Most recent 100 messages only — long-lived rooms accumulate unbounded
  // history and loading it all blows up server render time and payload size.
  // Query newest-first + limit, then reverse for oldest→newest display order.
  const { data: recentMessages } = await admin
    .from('chat_messages')
    .select('id, sender_id, body, attachment_url, attachment_kind, created_at')
    .eq('room_id', params.roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const messages = (recentMessages ?? []).slice().reverse()

  // Room title
  let title = room.name
  if (room.kind === 'dm') {
    const other = (members ?? []).find((m: any) => m.user_id !== user.id)
    title = (other as any)?.users?.name ?? 'Direct message'
  } else if (!title) {
    title = room.kind === 'squad' ? 'Squad chat' : 'Chat room'
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <Link href="/chat" className="p-2 -ml-2 rounded-lg active:bg-gray-100">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground capitalize">
            {room.kind === 'dm' ? 'Direct message' : `${members?.length ?? 0} members`}
          </p>
        </div>
      </header>

      {isGroupRoom && (
        <GroupMembers
          roomId={params.roomId}
          members={(members ?? []) as any}
          currentUserId={user.id}
          isStaff={!!isStaff}
          syncYearGroup={room.sync_year_group ?? null}
        />
      )}
      {isGroupRoom && isStaff && !room.sync_year_group && (
        <div className="border-t bg-white px-3 pb-2">
          <AddGroupMembers roomId={params.roomId} addable={addable} />
        </div>
      )}

      <ChatThread
        roomId={params.roomId}
        roomKind={room.kind}
        currentUserId={user.id}
        initialMessages={(messages ?? []) as any}
        members={(members ?? []) as any}
        canSend={canSend}
      />
    </div>
  )
}
