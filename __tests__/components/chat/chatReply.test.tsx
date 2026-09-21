import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ChatThread } from '@/app/chat/[roomId]/ChatThread'
import type { ChatMessage, ReplyParent } from '@/lib/chat/types'

// jsdom does not implement Element.scrollTo; the component calls it to keep
// the thread scrolled to the latest message. Not part of the feature under
// test — a plain environment shim so rendering doesn't throw.
Element.prototype.scrollTo = jest.fn()

jest.mock('@/app/chat/actions', () => ({
  markRead: jest.fn(),
  // send() awaits `.catch()` on this when roomKind !== 'bot' — these tests
  // use roomKind 'custom', so it must resolve like the real action does.
  notifyRoomMembers: jest.fn(() => Promise.resolve()),
}))

// `on` and `subscribe` return the channel itself (real supabase-js builder
// pattern), so the mock object's type has to be declared up front — a
// bare object literal can't infer its own type while a property inside it
// references the variable being defined.
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

/** Drives a brand-new message in over realtime. Takes the LAST registered
 *  handler — `channelMock.on` accumulates calls across renders. */
function fireMessageInsert(row: ChatMessage) {
  const calls = channelMock.on.mock.calls.filter(c => {
    if (c[0] !== 'postgres_changes') return false
    const cfg = c[1] as { table?: string; event?: string }
    return cfg?.table === 'chat_messages' && cfg?.event === 'INSERT'
  })
  const handler = calls[calls.length - 1]?.[2] as ((p: { new: ChatMessage }) => void) | undefined
  if (!handler) throw new Error('chat_messages INSERT handler was not registered')
  handler({ new: row })
}

const insertMock = jest.fn(() => ({
  select: () => ({
    single: () => Promise.resolve<{ data: null; error: { message: string } | null }>({ data: null, error: null }),
  }),
}))

// The lazy reply-parent lookup: .select(...).in('id', ids).eq('room_id', id)
const eqMock = jest.fn((_col: string, _val: string) =>
  Promise.resolve<{ data: ReplyParent[] }>({ data: [] }))
const inMock = jest.fn((_col: string, _ids: string[]) => ({ eq: eqMock }))

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
      in: inMock,
    })),
  }
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => channelMock,
    removeChannel: jest.fn(),
    from: (table: string) => {
      if (table === 'chat_messages') return makeChatMessagesFrom()
      throw new Error(`Unexpected table: ${table}`)
    },
    storage: { from: () => ({ createSignedUrl: jest.fn() }) },
  }),
}))

const messages: ChatMessage[] = [
  { id: 'm1', sender_id: 'u2', body: 'Training moved to 6pm', attachment_url: null, attachment_kind: null, created_at: '2026-09-21T17:00:00.000Z', reply_to_id: null, poll_id: null },
  { id: 'm2', sender_id: 'student-1', body: 'Got it', attachment_url: null, attachment_kind: null, created_at: '2026-09-21T17:01:00.000Z', reply_to_id: 'm1', poll_id: null },
]

const members = [
  { user_id: 'u2', users: { id: 'u2', name: 'Coach Phil', avatar_url: null } },
  { user_id: 'student-1', users: { id: 'student-1', name: 'Alfie', avatar_url: null } },
]

function renderThread(extra: Partial<React.ComponentProps<typeof ChatThread>> = {}) {
  return render(
    <ChatThread
      roomId="room-1"
      roomKind="custom"
      currentUserId="student-1"
      initialMessages={messages}
      initialReactions={[]}
      initialReplyParents={[]}
      members={members as any}
      {...extra}
    />
  )
}

describe('chat replies', () => {
  beforeEach(() => {
    insertMock.mockClear()
    inMock.mockClear()
    eqMock.mockClear()
    eqMock.mockImplementation(() => Promise.resolve({ data: [] }))
  })

  it('renders the quote from a parent inside the loaded window', async () => {
    await act(async () => { renderThread() })
    // The quote repeats the parent body, so it appears twice: once as the
    // original message, once inside m2's quote strip.
    expect(screen.getAllByText('Training moved to 6pm')).toHaveLength(2)
  })

  it('renders a quote for a parent outside the window from initialReplyParents', async () => {
    const older: ReplyParent = { id: 'm0', sender_id: 'u2', body: 'Old news', attachment_kind: null, deleted_at: null, poll_id: null }
    await act(async () => {
      renderThread({
        initialMessages: [{ ...messages[1], reply_to_id: 'm0' }],
        initialReplyParents: [older],
      })
    })
    expect(screen.getByText('Old news')).toBeInTheDocument()
  })

  it('renders the deleted stub when the parent was soft-deleted', async () => {
    const deleted: ReplyParent = { id: 'm0', sender_id: 'u2', body: 'Old news', attachment_kind: null, deleted_at: '2026-09-21T18:00:00.000Z', poll_id: null }
    await act(async () => {
      renderThread({
        initialMessages: [{ ...messages[1], reply_to_id: 'm0' }],
        initialReplyParents: [deleted],
      })
    })
    expect(screen.getByText('Message deleted')).toBeInTheDocument()
  })

  it('sends reply_to_id when replying, and clears the composer stub after', async () => {
    await act(async () => { renderThread() })
    fireEvent.click(screen.getAllByLabelText('React to message')[0])
    fireEvent.click(screen.getByText('Reply'))

    // Composer now shows the quoted stub with a cancel affordance.
    expect(screen.getByLabelText('Cancel reply')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Message…'), { target: { value: 'On my way' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    await waitFor(() =>
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ reply_to_id: 'm1' }))
    )
    await waitFor(() => expect(screen.queryByLabelText('Cancel reply')).not.toBeInTheDocument())
  })

  it('cancels a pending reply without sending', async () => {
    await act(async () => { renderThread() })
    fireEvent.click(screen.getAllByLabelText('React to message')[0])
    fireEvent.click(screen.getByText('Reply'))
    fireEvent.click(screen.getByLabelText('Cancel reply'))
    expect(screen.queryByLabelText('Cancel reply')).not.toBeInTheDocument()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('keeps the composer reply stub in place when the send fails', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    insertMock.mockImplementationOnce(() => ({
      select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }),
    }))
    await act(async () => { renderThread() })
    fireEvent.click(screen.getAllByLabelText('React to message')[0])
    fireEvent.click(screen.getByText('Reply'))
    expect(screen.getByLabelText('Cancel reply')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Message…'), { target: { value: 'On my way' } })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'))
    })

    expect(alertSpy).toHaveBeenCalledWith('Send failed: boom')
    // The user's reply target must not be silently lost on a failed send.
    expect(screen.getByLabelText('Cancel reply')).toBeInTheDocument()
    alertSpy.mockRestore()
  })

  // Regression guard for the lazy reply-parent fetch: an id the query can
  // never resolve (RLS denies it, or the row was hard-deleted) must be
  // attempted at most once. Before the fix, `setReplyParents` was called
  // unconditionally on every fetch — even when it added no keys — which
  // produced a new object reference, retriggered the effect (it depends on
  // `replyParents`), recomputed the same still-missing id, and fetched
  // again forever.
  it('fetches an unresolvable reply parent exactly once — no retry loop', async () => {
    const replyToGhost: ChatMessage = { ...messages[1], id: 'm3', reply_to_id: 'ghost' }
    await act(async () => {
      renderThread({ initialMessages: [messages[0], replyToGhost] })
    })

    await waitFor(() => expect(inMock).toHaveBeenCalledTimes(1))
    expect(inMock).toHaveBeenCalledWith('id', ['ghost'])

    // Flush further render/effect cycles. Under the bug, `inMock` would
    // keep growing without bound instead of settling at 1.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(inMock).toHaveBeenCalledTimes(1)
  })

  // Same class as the admin-client fix in page.tsx: reply_to_id is
  // attacker-controlled (migration 011's insert policy validates neither it
  // nor poll_id), so a member of two rooms could otherwise quote a message
  // from one inside the other.
  it('constrains the reply-parent lookup to this room', async () => {
    const replyToGhost: ChatMessage = { ...messages[1], id: 'm3', reply_to_id: 'ghost' }
    await act(async () => {
      renderThread({ initialMessages: [messages[0], replyToGhost] })
    })
    await waitFor(() => expect(inMock).toHaveBeenCalledWith('id', ['ghost']))
    expect(eqMock).toHaveBeenCalledWith('room_id', 'room-1')
  })

  // Regression for the cancel-plus-attempted-guard race: the id is marked
  // attempted before the request fires, and React runs this effect's cleanup
  // on every `messages` change — not just on unmount. Without unmarking on
  // the cancelled path, one more message arriving mid-flight discarded the
  // response and left the parent unfetchable, so the quote stayed blank.
  it('still resolves the parent when a second message arrives mid-flight', async () => {
    const older: ReplyParent = { id: 'm0', sender_id: 'u2', body: 'Old news', attachment_kind: null, deleted_at: null, poll_id: null }
    let release: (value: { data: ReplyParent[] }) => void = () => {}
    eqMock.mockImplementationOnce(() =>
      new Promise<{ data: ReplyParent[] }>(res => { release = res }))
    eqMock.mockImplementation(() => Promise.resolve({ data: [older] }))

    await act(async () => {
      renderThread({ initialMessages: [{ ...messages[1], reply_to_id: 'm0' }] })
    })
    await waitFor(() => expect(inMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      fireMessageInsert({
        id: 'm11',
        sender_id: 'u2',
        body: 'nice',
        attachment_url: null,
        attachment_kind: null,
        created_at: '2026-09-21T17:02:00.000Z',
        reply_to_id: null,
        poll_id: null,
      })
    })

    await waitFor(() => expect(inMock).toHaveBeenCalledTimes(2))
    await act(async () => { release({ data: [] }) })

    await waitFor(() => expect(screen.getByText('Old news')).toBeInTheDocument())
  })

  // Spec §6: "If the original is not in the loaded window, the strip is not
  // tappable."
  describe('jump-to-original tappability', () => {
    it('is tappable when the parent is in the loaded window', async () => {
      await act(async () => { renderThread() })
      const matches = screen.getAllByText('Training moved to 6pm')
      const quote = matches.find(el => el.closest('button'))
      expect(quote).toBeTruthy()
    })

    it('is NOT tappable when the parent came from initialReplyParents (outside the loaded window)', async () => {
      const older: ReplyParent = { id: 'm0', sender_id: 'u2', body: 'Old news', attachment_kind: null, deleted_at: null, poll_id: null }
      await act(async () => {
        renderThread({
          initialMessages: [{ ...messages[1], reply_to_id: 'm0' }],
          initialReplyParents: [older],
        })
      })
      const quote = screen.getByText('Old news')
      expect(quote.closest('button')).toBeNull()
    })
  })
})
