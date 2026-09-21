import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ChatThread } from '@/app/chat/[roomId]/ChatThread'
import type { ChatMessage, Poll, PollOption } from '@/lib/chat/types'

// jsdom does not implement Element.scrollTo; the component calls it to keep
// the thread scrolled to the latest message. Not part of the feature under
// test — a plain environment shim so rendering doesn't throw.
Element.prototype.scrollTo = jest.fn()

const closePollMock = jest.fn((_pollId: string) =>
  Promise.resolve<{ ok: boolean; error?: string }>({ ok: true }))

jest.mock('@/app/chat/actions', () => ({
  markRead: jest.fn(),
  notifyRoomMembers: jest.fn(() => Promise.resolve()),
  createPoll: jest.fn(() => Promise.resolve({ ok: true })),
  closePoll: (...args: [string]) => closePollMock(...args),
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

function findHandler(table: string, event?: string) {
  const call = channelMock.on.mock.calls.find(c => {
    if (c[0] !== 'postgres_changes') return false
    const cfg = c[1] as { table?: string; event?: string }
    return cfg?.table === table && (event === undefined || cfg?.event === event)
  })
  return call?.[2] as ((payload: Record<string, unknown>) => void) | undefined
}

// Finds the handler ChatThread registered for the chat_poll_options
// subscription and fires it with an UPDATE-shaped payload, so a test can
// simulate the realtime tally update without a real socket.
function firePollOptionsUpdate(row: PollOption) {
  const handler = findHandler('chat_poll_options')
  if (!handler) throw new Error('chat_poll_options handler was not registered')
  handler({ new: row })
}

// Drives a brand-new message in over realtime, exactly as the socket would.
function fireMessageInsert(row: ChatMessage) {
  const handler = findHandler('chat_messages', 'INSERT')
  if (!handler) throw new Error('chat_messages INSERT handler was not registered')
  handler({ new: row })
}

const voteUpsertMock = jest.fn(() => Promise.resolve({ error: null }))

const insertMock = jest.fn(() => ({
  select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
}))

// What the client-side "resolve a poll I don't have" fetch returns. Set per
// test; empty by default so no existing test accidentally gains a poll.
let fetchedPolls: Poll[] = []
let fetchedOptions: PollOption[] = []

const pollsSelectInMock = jest.fn(() => Promise.resolve({ data: fetchedPolls }))
const optionsSelectInMock = jest.fn(() => ({
  order: jest.fn(() => Promise.resolve({ data: fetchedOptions })),
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
    select: jest.fn(() => ({
      // loadVoters: .select(...).eq('poll_id', id)
      eq: jest.fn(() => Promise.resolve({ data: [] })),
      // the unknown-poll fetch: .select(...).in('poll_id', ids).eq('user_id', me)
      in: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: [] })) })),
    })),
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
      if (table === 'chat_polls') return { select: jest.fn(() => ({ in: pollsSelectInMock })) }
      if (table === 'chat_poll_options') return { select: jest.fn(() => ({ in: optionsSelectInMock })) }
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
    closePollMock.mockClear()
    closePollMock.mockImplementation(() => Promise.resolve({ ok: true }))
    pollsSelectInMock.mockClear()
    optionsSelectInMock.mockClear()
    fetchedPolls = []
    fetchedOptions = []
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

  // The safety-critical property of this feature is that a student can never
  // learn how another student voted. One of the four layers holding it up is
  // a deliberate OMISSION — chat_poll_votes is not in the realtime
  // publication and nothing subscribes to it — which no other test records.
  // Adding a subscription here would leak every vote row to every client the
  // moment Realtime started publishing that table.
  it('never subscribes to chat_poll_votes over realtime', async () => {
    await act(async () => { renderThreadWithPoll() })
    const tables = channelMock.on.mock.calls
      .filter(c => c[0] === 'postgres_changes')
      .map(c => (c[1] as { table?: string })?.table)
    expect(tables.length).toBeGreaterThan(0)
    expect(tables).not.toContain('chat_poll_votes')
  })

  // Regression for the "empty grey bubble" bug: a poll created after page
  // load arrives only as a carrier chat_messages INSERT whose body is null.
  // Seeded through initialPolls this bug is invisible, so it is deliberately
  // NOT seeded here.
  describe('a poll created after page load', () => {
    const newPoll: Poll = {
      id: 'poll-2',
      room_id: 'room-1',
      created_by: 'u2',
      question: 'Boots or trainers?',
      closed_at: null,
      created_at: '2026-09-21T18:00:00.000Z',
    }
    const newOptions: PollOption[] = [
      { id: 'n1', poll_id: 'poll-2', label: 'Boots', position: 0, vote_count: 0 },
      { id: 'n2', poll_id: 'poll-2', label: 'Trainers', position: 1, vote_count: 0 },
    ]
    const carrier: ChatMessage = {
      id: 'm9',
      sender_id: 'u2',
      body: null,
      attachment_url: null,
      attachment_kind: null,
      created_at: '2026-09-21T18:00:00.000Z',
      reply_to_id: null,
      poll_id: 'poll-2',
    }

    it('renders with its options when it arrives over realtime', async () => {
      fetchedPolls = [newPoll]
      fetchedOptions = newOptions
      await act(async () => {
        renderThreadWithPoll({ initialMessages: [], initialPolls: [], initialPollOptions: [] })
      })
      expect(screen.queryByText('Boots or trainers?')).not.toBeInTheDocument()

      await act(async () => { fireMessageInsert(carrier) })

      await waitFor(() => expect(screen.getByText('Boots or trainers?')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: /Boots/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Trainers/ })).toBeInTheDocument()
    })

    it('still resolves when the option rows arrive over realtime before the fetch returns', async () => {
      fetchedPolls = [newPoll]
      fetchedOptions = []
      await act(async () => {
        renderThreadWithPoll({ initialMessages: [], initialPolls: [], initialPollOptions: [] })
      })
      await act(async () => {
        // Options first, poll second — the opposite order to the test above.
        firePollOptionsUpdate(newOptions[0])
        firePollOptionsUpdate(newOptions[1])
        fireMessageInsert(carrier)
      })
      await waitFor(() => expect(screen.getByText('Boots or trainers?')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: /Boots/ })).toBeInTheDocument()
    })

    it('fetches an unresolvable poll exactly once — no retry loop', async () => {
      fetchedPolls = []
      fetchedOptions = []
      await act(async () => {
        renderThreadWithPoll({ initialMessages: [], initialPolls: [], initialPollOptions: [] })
      })
      await act(async () => { fireMessageInsert(carrier) })
      await waitFor(() => expect(pollsSelectInMock).toHaveBeenCalledTimes(1))
      expect(pollsSelectInMock).toHaveBeenCalledWith('id', ['poll-2'])

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(pollsSelectInMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('closing a poll', () => {
    it('surfaces the error when closePoll fails instead of doing nothing', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
      closePollMock.mockImplementation(() =>
        Promise.resolve({ ok: false, error: 'Poll not found, or you cannot close it' }))
      await act(async () => { renderThreadWithPoll() })

      await act(async () => { fireEvent.click(screen.getByText('Close poll')) })

      expect(closePollMock).toHaveBeenCalledWith('poll-1')
      expect(alertSpy).toHaveBeenCalledWith(
        'Could not close the poll: Poll not found, or you cannot close it')
      // Still open — a failed close must not look like a successful one.
      expect(screen.getByText('Close poll')).toBeInTheDocument()
      alertSpy.mockRestore()
    })

    it('marks the poll closed on success', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
      await act(async () => { renderThreadWithPoll() })
      await act(async () => { fireEvent.click(screen.getByText('Close poll')) })
      expect(alertSpy).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.getByText('Poll closed')).toBeInTheDocument())
      alertSpy.mockRestore()
    })
  })

  // A double tap used to fire two upserts. The second one captured
  // `previous` as the synthetic `local-${pollId}` row the first one wrote,
  // so a rollback restored a fake vote id.
  it('disables the poll options while a vote is in flight', async () => {
    let release: (value: { error: null }) => void = () => {}
    voteUpsertMock.mockImplementationOnce(() => new Promise(res => { release = res }))
    await act(async () => { renderThreadWithPoll() })

    const yes = screen.getByRole('button', { name: /Yes/ })
    await act(async () => { fireEvent.click(yes) })

    expect(screen.getByRole('button', { name: /Yes/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^No/ })).toBeDisabled()

    await act(async () => { release({ error: null }) })
    await waitFor(() => expect(screen.getByRole('button', { name: /^No/ })).not.toBeDisabled())
  })

  // Spec §2 lists the AI Coach bot room as out of scope for both features.
  describe('the AI Coach bot room', () => {
    it('offers neither the New poll control nor Reply', async () => {
      await act(async () => {
        renderThreadWithPoll({ roomKind: 'bot', initialMessages: [pollMessage] })
      })
      expect(screen.queryByLabelText('New poll')).not.toBeInTheDocument()

      fireEvent.click(screen.getAllByLabelText('React to message')[0])
      expect(screen.queryByText('Reply')).not.toBeInTheDocument()
    })
  })

  // A poll carrier has body === null and attachment_kind === null, which the
  // quote used to render as "Message deleted".
  it('quotes a reply to a poll as "Poll", not as a deleted message', async () => {
    const replyToPoll: ChatMessage = {
      id: 'm2',
      sender_id: 'student-1',
      body: 'Count me in',
      attachment_url: null,
      attachment_kind: null,
      created_at: '2026-09-21T17:05:00.000Z',
      reply_to_id: 'm1',
      poll_id: null,
    }
    await act(async () => {
      renderThreadWithPoll({ initialMessages: [pollMessage, replyToPoll] })
    })
    expect(screen.getByText('Poll')).toBeInTheDocument()
    expect(screen.queryByText('Message deleted')).not.toBeInTheDocument()
  })
})
