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

const insertMock = jest.fn(() => ({
  select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
}))

const inMock = jest.fn(() => Promise.resolve({ data: [] }))

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
  })

  it('renders the quote from a parent inside the loaded window', async () => {
    await act(async () => { renderThread() })
    // The quote repeats the parent body, so it appears twice: once as the
    // original message, once inside m2's quote strip.
    expect(screen.getAllByText('Training moved to 6pm')).toHaveLength(2)
  })

  it('renders a quote for a parent outside the window from initialReplyParents', async () => {
    const older: ReplyParent = { id: 'm0', sender_id: 'u2', body: 'Old news', attachment_kind: null, deleted_at: null }
    await act(async () => {
      renderThread({
        initialMessages: [{ ...messages[1], reply_to_id: 'm0' }],
        initialReplyParents: [older],
      })
    })
    expect(screen.getByText('Old news')).toBeInTheDocument()
  })

  it('renders the deleted stub when the parent was soft-deleted', async () => {
    const deleted: ReplyParent = { id: 'm0', sender_id: 'u2', body: 'Old news', attachment_kind: null, deleted_at: '2026-09-21T18:00:00.000Z' }
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
})
