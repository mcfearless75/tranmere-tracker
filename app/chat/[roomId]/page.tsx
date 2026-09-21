import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ChatThread } from './ChatThread'
import { GroupMembers } from './GroupMembers'
import { AddGroupMembers } from './AddGroupMembers'
import type { Poll, PollOption, PollVote, ReplyParent } from '@/lib/chat/types'

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
    .select('user_id, role, users:user_id(id, name, avatar_url, role, is_active)')
    .eq('room_id', params.roomId)

  const me = (members ?? []).find((m: any) => m.user_id === user.id)
  // Must match is_chat_staff() in migration 082 exactly — role list AND
  // is_active. Dropping the is_active clause here would show a deactivated
  // coach a "New poll" / "Close poll" UI the database then silently refuses.
  const meUser = (me as any)?.users
  const isStaff = !!meUser
    && ['admin', 'coach', 'teacher'].includes(meUser.role ?? '')
    && meUser.is_active === true
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

  const { data: recentMessages } = await admin
    .from('chat_messages')
    .select('id, sender_id, body, attachment_url, attachment_kind, created_at, reply_to_id, poll_id')
    .eq('room_id', params.roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const messages = (recentMessages ?? []).slice().reverse()
  const messageIds = messages.map((m: any) => m.id)

  // A reply can point outside the 100-message window. Without this fetch the
  // quote renders blank for anything older.
  const windowIds = new Set(messages.map((m: any) => m.id))
  const missingParentIds = Array.from(new Set(
    messages
      .map((m: any) => m.reply_to_id)
      .filter((id: string | null): id is string => !!id && !windowIds.has(id))
  ))

  let replyParents: ReplyParent[] = []
  if (missingParentIds.length) {
    // room_id is not optional. This runs on the admin client, which bypasses
    // RLS, and reply_to_id is attacker-controlled: migration 011's insert
    // policy only checks room membership and sender_id, and its update
    // policy has no WITH CHECK at all, so a sender can point their own
    // message's reply_to_id at any message id in the database. Without this
    // constraint, quoting a message id lifted from a private DM would render
    // that message's text and author to the whole room.
    const { data } = await admin
      .from('chat_messages')
      .select('id, sender_id, body, attachment_kind, deleted_at, poll_id')
      .in('id', missingParentIds)
      .eq('room_id', params.roomId)
    replyParents = (data ?? []) as ReplyParent[]
  }

  let reactions: { id: string; message_id: string; user_id: string; emoji: string }[] = []
  if (messageIds.length) {
    const { data: reactionRows, error: reactionErr } = await admin
      .from('chat_message_reactions')
      .select('id, message_id, user_id, emoji')
      .in('message_id', messageIds)
    if (!reactionErr) reactions = (reactionRows ?? []) as any
  }

  const pollIds = messages
    .map((m: any) => m.poll_id)
    .filter((id: string | null): id is string => !!id)

  let polls: Poll[] = []
  let pollOptions: PollOption[] = []
  let myVotes: PollVote[] = []

  if (pollIds.length) {
    // Same admin-client hazard as the reply-parent fetch above: poll_id is
    // attacker-controlled, so the poll lookup is constrained to this room.
    // Options and votes then key off the ids that survived that filter, so a
    // poll belonging to another room can never contribute its labels or its
    // live tallies to this page.
    const { data: pollRows } = await admin
      .from('chat_polls')
      .select('*')
      .in('id', pollIds)
      .eq('room_id', params.roomId)
    polls = (pollRows ?? []) as Poll[]

    const roomPollIds = polls.map(p => p.id)
    if (roomPollIds.length) {
      // Only the viewer's own votes are fetched here — this query runs
      // through the admin client, which bypasses RLS entirely. Fetching
      // every vote would ship the whole room's ballot to every student in
      // the initial HTML no matter how tight the RLS policies on
      // chat_poll_votes are. Staff load the full voter list later, from the
      // client, where their RLS policy actually applies (see loadVoters in
      // ChatThread).
      const [{ data: optionRows }, { data: voteRows }] = await Promise.all([
        admin.from('chat_poll_options').select('*').in('poll_id', roomPollIds).order('position'),
        admin.from('chat_poll_votes').select('id, poll_id, option_id, user_id')
          .in('poll_id', roomPollIds).eq('user_id', user.id),
      ])
      pollOptions = (optionRows ?? []) as PollOption[]
      myVotes = (voteRows ?? []) as PollVote[]
    }
  }

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
          <p className="font-semibold break-words">{title}</p>
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
        initialReactions={reactions}
        initialReplyParents={replyParents}
        initialPolls={polls}
        initialPollOptions={pollOptions}
        initialMyVotes={myVotes}
        isChatStaff={!!isStaff}
        members={(members ?? []) as any}
        canSend={canSend}
      />
    </div>
  )
}
