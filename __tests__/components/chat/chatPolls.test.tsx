import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ChatThread } from '@/app/chat/[roomId]/ChatThread'
import type { ChatMessage, Poll, PollOption } from '@/lib/chat/types'

// jsdom does not implement Element.scrollTo; the component calls it to keep
// the thread scrolled to the latest message. Not part of the feature under
// test — a plain environment shim so rendering doesn't throw.
Element.prototype.scrollTo = jest.fn()

jest.mock('@/app/chat/actions', () => ({
  markRead: jest.fn(),
  notifyRoomMembers: jest.fn(() => Promise.resolve()),
  createPoll: jest.fn(() => Promise.resolve({ ok: true })),
  closePoll: jest.fn(() => Promise.resolve({ ok: true })),
}))

// `on` and `subscribe` return the channel itself (real supabase-js builder
// pattern), so the mock object's type has to be declared up front — a
// bare object literal can't infer its own type while a property inside it
// references the variable being defined. Same shape as ChatThread.test.tsx
// and chatReply.test.tsx.
interface ChannelMock {
  on: jest.Mock<ChannelMock, [string, unknown, unknown]>
  subscribe: jest.Mock<ChannelMock, [(status: string) => void]>
  track: jest.Mock<Promise<void>, []>
  presenceState: jest.Mock<Record<string, unknown>, []>
}

const channelMock: ChannelMock = {
  on: jest.fn((..._args: [string, unknown, unknown]) => channelMock),
  subscribe: jest.fn((cb: (status: string) => void) => {
    Promise.resolve().then(() => cb('SUBSCRIBED'))
    return channelMock
  }),
  track: jest.fn(() => Promise.resolve()),
  presenceState: jest.fn(() => ({})),
}

// Finds the handler ChatThread registered for the chat_poll_options
// subscription and fires it with an UPDATE-shaped payload, so a test can
// simulate the realtime tally update without a real socket.
function firePollOptionsUpdate(row: PollOption) {
  const call = channelMock.on.mock.calls.find(
    c => c[0] === 'postgres_changes' && (c[1] as { table?: string })?.table === 'chat_poll_options',
  )
  const handler = call?.[2] as ((payload: { new: PollOption }) => void) | undefined
  if (!handler) throw new Error('chat_poll_options handler was not registered')
  handler({ new: row })
}

const voteUpsertMock = jest.fn(() => Promise.resolve({ error: null }))

const insertMock = jest.fn(() => ({
  select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
}))

function makeChatMessagesFrom() {
  return {
    insert: insertMock,
    update: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          gt: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({ maybeSingle: jest.fn(() => Promise.resolve({ data: null })) })),
            })),
          })),
        })),
      })),
      in: jest.fn(() => Promise.resolve({ data: [] })),
    })),
  }
}

function makeChatPollVotesFrom() {
  return {
    upsert: voteUpsertMock,
    select: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: [] })) })),
    delete: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })),
  }
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => channelMock,
    removeChannel: jest.fn(),
    from: (table: string) => {
      if (table === 'chat_messages') return makeChatMessagesFrom()
      if (table === 'chat_poll_votes') return makeChatPollVotesFrom()
      throw new Error(`Unexpected table: ${table}`)
    },
    storage: { from: () => ({ createSignedUrl: jest.fn() }) },
  }),
}))

const poll: Poll = {
  id: 'poll-1',
  room_id: 'room-1',
  created_by: 'u2',
  question: 'Who is coming Saturday?',
  closed_at: null,
  created_at: '2026-09-21T17:00:00.000Z',
}

const options: PollOption[] = [
  { id: 'o1', poll_id: 'poll-1', label: 'Yes', position: 0, vote_count: 1 },
  { id: 'o2', poll_id: 'poll-1', label: 'No', position: 1, vote_count: 0 },
]

const pollMessage: ChatMessage = {
  id: 'm1',
  sender_id: 'u2',
  body: null,
  attachment_url: null,
  attachment_kind: null,
  created_at: '2026-09-21T17:00:00.000Z',
  reply_to_id: null,
  poll_id: 'poll-1',
}

const members = [
  { user_id: 'u2', users: { id: 'u2', name: 'Coach Phil', avatar_url: null } },
  { user_id: 'student-1', users: { id: 'student-1', name: 'Alfie', avatar_url: null } },
]

function renderThreadWithPoll(extra: Partial<React.ComponentProps<typeof ChatThread>> = {}) {
  return render(
    <ChatThread
      roomId="room-1"
      roomKind="custom"
      currentUserId="student-1"
      initialMessages={[pollMessage]}
      initialReactions={[]}
      initialReplyParents={[]}
      initialPolls={[poll]}
      initialPollOptions={options}
      initialMyVotes={[]}
      isChatStaff
      members={members as any}
      {...extra}
    />
  )
}

describe('polls in the thread', () => {
  beforeEach(() => {
    voteUpsertMock.mockClear()
    channelMock.on.mockClear()
  })

  it('renders a poll message as a PollCard instead of a text bubble', async () => {
    await act(async () => { renderThreadWithPoll() })
    expect(screen.getByText('Who is coming Saturday?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Yes/ })).toBeInTheDocument()
  })

  it('upserts a vote keyed on poll_id and user_id when an option is tapped', async () => {
    await act(async () => { renderThreadWithPoll() })
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
    await waitFor(() => expect(voteUpsertMock).toHaveBeenCalledWith(
      { poll_id: 'poll-1', option_id: 'o1', user_id: 'student-1' },
      { onConflict: 'poll_id,user_id' },
    ))
  })

  it('updates the tally live from a chat_poll_options realtime UPDATE', async () => {
    await act(async () => { renderThreadWithPoll() })
    expect(screen.getByText('1 vote')).toBeInTheDocument()
    await act(async () => {
      firePollOptionsUpdate({ id: 'o1', poll_id: 'poll-1', label: 'Yes', position: 0, vote_count: 5 })
    })
    expect(screen.getByText('5 votes')).toBeInTheDocument()
  })

  it('shows the New poll control to staff only', async () => {
    await act(async () => { renderThreadWithPoll({ isChatStaff: false }) })
    expect(screen.queryByLabelText('New poll')).not.toBeInTheDocument()
  })

  it('lets a student in a broadcast room vote even though they cannot post', async () => {
    await act(async () => { renderThreadWithPoll({ roomKind: 'broadcast', canSend: false }) })
    expect(screen.getByText(/only staff can post/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
    await waitFor(() => expect(voteUpsertMock).toHaveBeenCalled())
  })
})
