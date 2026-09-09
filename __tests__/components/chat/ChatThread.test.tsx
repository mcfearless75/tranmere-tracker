import { render, screen, act, fireEvent } from '@testing-library/react'
import { ChatThread } from '@/app/chat/[roomId]/ChatThread'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000099'
const ROOM_ID = 'room-1'
const CURRENT_USER_ID = 'student-1'

// jsdom does not implement Element.scrollTo; the component calls it to keep
// the thread scrolled to the latest message. Not part of the feature under
// test — a plain environment shim so rendering doesn't throw.
Element.prototype.scrollTo = jest.fn()

jest.mock('@/app/chat/actions', () => ({
  markRead: jest.fn(),
  notifyRoomMembers: jest.fn(),
}))

const insertSingleMock = jest.fn(() =>
  Promise.resolve({ data: { id: 'sent-1', sender_id: CURRENT_USER_ID, body: 'Hi', attachment_url: null, attachment_kind: null, created_at: new Date().toISOString() }, error: null })
)
const fallbackMaybeSingleMock = jest.fn(() => Promise.resolve({ data: null }))

const channelMock = {
  on: jest.fn(() => channelMock),
  // Real supabase-js invokes the subscribe callback asynchronously (after a
  // socket round-trip), by which point the component's `channel` local is
  // already assigned. Firing synchronously here — before `.subscribe()` has
  // returned to the component's assignment — would throw a TDZ
  // ReferenceError on `channel` inside the callback, which is a mock-timing
  // artifact, not real behavior. Deferring to a microtask matches reality.
  subscribe: jest.fn((cb: (status: string) => void) => {
    Promise.resolve().then(() => cb('SUBSCRIBED'))
    return channelMock
  }),
  track: jest.fn(() => Promise.resolve()),
  presenceState: jest.fn(() => ({})),
}

function makeChatMessagesFrom() {
  return {
    insert: jest.fn(() => ({ select: jest.fn(() => ({ single: insertSingleMock })) })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          gt: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({ maybeSingle: fallbackMaybeSingleMock })),
            })),
          })),
        })),
      })),
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

beforeEach(() => {
  jest.useFakeTimers()
  insertSingleMock.mockClear()
  fallbackMaybeSingleMock.mockClear()
  channelMock.on.mockClear()
  global.fetch = jest.fn(() => Promise.resolve({ ok: true } as Response)) as any
})

afterEach(() => {
  jest.useRealTimers()
})

function renderThread() {
  return render(
    <ChatThread
      roomId={ROOM_ID}
      roomKind="bot"
      currentUserId={CURRENT_USER_ID}
      initialMessages={[]}
      members={[{ user_id: CURRENT_USER_ID, users: { id: CURRENT_USER_ID, name: 'Caleb', avatar_url: null } }]}
    />
  )
}

// NOTE on the DOM interaction below: the brief's original version set
// `textarea.value` directly and dispatched a plain 'change' Event. That
// doesn't reach a React-controlled textarea's onChange — React tracks value
// changes via its own wrapped property setter and listens for the native
// 'input' event, so a manually-assigned `.value` plus a bare 'change' event
// is silently swallowed (draft state never updates, so Enter's `send()`
// call sees an empty body and returns early). Switched to
// `fireEvent.change`, which goes through the native value setter correctly
// and is the standard Testing Library way to drive a controlled input.
//
// Separately: the send button has no accessible name in the current markup
// (no aria-label, no visible text — just an <svg> icon), so
// `getByRole('button', { name: '' })` would technically resolve it, but
// clicking it is awkward to express intentionally; Enter-to-send exercises
// the same `send()` path and is what a keyboard user would actually do.
async function sendMessage(text: string) {
  const textarea = screen.getByPlaceholderText('Message…')
  await act(async () => {
    fireEvent.change(textarea, { target: { value: text } })
  })
  await act(async () => {
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  })
}

describe('ChatThread — AI reply Realtime fallback', () => {
  it('does not run the fallback query if Realtime delivers the bot reply before the timeout', async () => {
    renderThread()
    await sendMessage('How was training?')
    // Simulate Realtime delivering the bot's reply immediately.
    const onInsertHandler = channelMock.on.mock.calls.find(c => c[0] === 'postgres_changes')?.[1] === undefined
      ? undefined
      : channelMock.on.mock.calls.find(c => c[0] === 'postgres_changes')![2]
    await act(async () => {
      onInsertHandler?.({ new: { id: 'bot-1', sender_id: BOT_USER_ID, body: 'Reply', created_at: new Date().toISOString() } })
    })
    await act(async () => { jest.advanceTimersByTime(20_000) })
    expect(fallbackMaybeSingleMock).not.toHaveBeenCalled()
  })

  it('falls back to a DB check and shows the reply when the timer fires with no Realtime event', async () => {
    fallbackMaybeSingleMock.mockResolvedValueOnce({
      data: { id: 'bot-2', sender_id: BOT_USER_ID, body: 'Fallback reply', attachment_url: null, attachment_kind: null, created_at: new Date().toISOString() },
    })
    renderThread()
    await sendMessage('best food for a match')
    await act(async () => { jest.advanceTimersByTime(20_000) })
    expect(fallbackMaybeSingleMock).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Fallback reply')).toBeInTheDocument()
  })

  it('shows the timed-out message when the fallback finds nothing', async () => {
    fallbackMaybeSingleMock.mockResolvedValueOnce({ data: null })
    renderThread()
    await sendMessage('anything')
    await act(async () => { jest.advanceTimersByTime(20_000) })
    expect(await screen.findByText(/Taking longer than usual/)).toBeInTheDocument()
  })
})
