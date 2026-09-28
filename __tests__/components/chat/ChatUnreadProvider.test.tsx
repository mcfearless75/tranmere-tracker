import { act, render, screen, fireEvent } from '@testing-library/react'

const ROOM_A = '11111111-1111-4111-8111-111111111111'

let mockPathname = '/dashboard'
const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

const mockPlayPing = jest.fn()
jest.mock('@/lib/chat/ping', () => ({ playPing: () => mockPlayPing(), unlockPing: jest.fn() }))

// Realtime: capture the INSERT handler so tests can "deliver" a message.
let insertHandler: ((p: { new: Record<string, unknown> }) => void) | null = null
const mockRemoveChannel = jest.fn()
let mockUserId: string | null = 'me'
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const channel = {
      on: (_t: string, _f: unknown, cb: (p: { new: Record<string, unknown> }) => void) => { insertHandler = cb; return channel },
      subscribe: () => channel,
    }
    return {
      auth: {
        getUser: async () => ({ data: { user: mockUserId ? { id: mockUserId } : null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
      },
      channel: () => channel,
      removeChannel: mockRemoveChannel,
    }
  },
}))
jest.mock('@/lib/native', () => ({ isNative: () => false, getPlatform: () => 'web' }))

import { ChatUnreadProvider, BANNER_MS } from '@/components/chat/ChatUnreadProvider'
import { UnreadBadge } from '@/components/chat/UnreadBadge'

const fetchMock = jest.fn()
let summary: { total: number; latest: unknown }
const latest = { id: 'm1', roomId: ROOM_A, roomLabel: 'Year 1', senderName: 'Coach Dave', preview: 'Kit on, 3pm', createdAt: '' }

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  mockPathname = '/dashboard'
  mockUserId = 'me'
  insertHandler = null
  summary = { total: 2, latest }
  global.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ ok: true, ...summary }) }))
})
afterEach(() => jest.useRealTimers())

async function mount() {
  const utils = render(<ChatUnreadProvider><UnreadBadge /></ChatUnreadProvider>)
  await act(async () => {})
  return utils
}

async function deliver(senderId: string) {
  await act(async () => { insertHandler!({ new: { sender_id: senderId, room_id: ROOM_A } }) })
}

describe('ChatUnreadProvider', () => {
  it('shows the unread count on the badge, but no banner for messages already waiting', async () => {
    await mount()
    expect(screen.getByTestId('chat-unread-badge')).toHaveTextContent('2')
    expect(screen.queryByTestId('new-message-banner')).not.toBeInTheDocument()
  })

  it('pops a banner when someone else\'s message arrives, and tapping opens the room', async () => {
    await mount()
    summary = { total: 3, latest }
    await deliver('coach')
    const banner = screen.getByTestId('new-message-banner')
    expect(banner).toHaveTextContent('Coach Dave · Year 1')
    expect(banner).toHaveTextContent('Kit on, 3pm')
    expect(screen.getByTestId('chat-unread-badge')).toHaveTextContent('3')

    fireEvent.click(screen.getByText('Kit on, 3pm'))
    expect(mockPush).toHaveBeenCalledWith(`/chat/${ROOM_A}`)
    expect(screen.queryByTestId('new-message-banner')).not.toBeInTheDocument()
  })

  it('ignores the user\'s own messages', async () => {
    await mount()
    const before = fetchMock.mock.calls.length
    await deliver('me')
    expect(fetchMock.mock.calls.length).toBe(before)
    expect(screen.queryByTestId('new-message-banner')).not.toBeInTheDocument()
  })

  it('does not pop for the room already on screen, and asks the server to leave it out', async () => {
    mockPathname = `/chat/${ROOM_A}`
    await mount()
    await deliver('coach')
    expect(screen.queryByTestId('new-message-banner')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/chat/unread?viewing=${ROOM_A}`, expect.anything())
  })

  it('auto-dismisses, and can be closed', async () => {
    await mount()
    await deliver('coach')
    expect(screen.getByTestId('new-message-banner')).toBeInTheDocument()
    await act(async () => { jest.advanceTimersByTime(BANNER_MS + 10) })
    expect(screen.queryByTestId('new-message-banner')).not.toBeInTheDocument()

    summary = { total: 3, latest: { ...latest, id: 'm2' } }
    await deliver('coach')
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByTestId('new-message-banner')).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does nothing when signed out', async () => {
    mockUserId = null
    await mount()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(insertHandler).toBeNull()
    expect(screen.queryByTestId('chat-unread-badge')).not.toBeInTheDocument()
  })

  it('keeps working when the unread lookup fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    await mount()
    await deliver('coach')
    expect(screen.queryByTestId('chat-unread-badge')).not.toBeInTheDocument()
  })

  it('pings once when the banner shows, never for own messages or the open room', async () => {
    await mount()
    await deliver('me')
    expect(mockPlayPing).not.toHaveBeenCalled()
    await deliver('coach')
    expect(mockPlayPing).toHaveBeenCalledTimes(1)
    await deliver('coach') // same latest message id: no repeat
    expect(mockPlayPing).toHaveBeenCalledTimes(1)
  })

  it('does not ping for the room already on screen', async () => {
    mockPathname = `/chat/${ROOM_A}`
    await mount()
    await deliver('coach')
    expect(mockPlayPing).not.toHaveBeenCalled()
  })

  it('re-fetches the chat list when a message arrives while it is open, so the room jumps to the top', async () => {
    mockPathname = '/chat'
    await mount()
    await deliver('coach')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('also re-fetches the parent messages list', async () => {
    mockPathname = '/parent/messages'
    await mount()
    await deliver('coach')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh other pages, or for own messages', async () => {
    await mount()
    await deliver('coach')
    mockPathname = '/chat'
    await deliver('me')
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
