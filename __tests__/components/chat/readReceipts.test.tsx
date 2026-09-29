import { render, screen, act, fireEvent } from '@testing-library/react'
import { ChatThread } from '@/app/chat/[roomId]/ChatThread'
import { markRead } from '@/app/chat/actions'

Element.prototype.scrollTo = jest.fn()

jest.mock('@/app/chat/actions', () => ({
  markRead: jest.fn(() => Promise.resolve('2026-09-29T12:00:00.000Z')),
  notifyRoomMembers: jest.fn(),
}))

type Handler = (payload: unknown) => void
const handlers: { type: string; filter: { event?: string; table?: string }; cb: Handler }[] = []

interface ChannelMock {
  on: jest.Mock
  subscribe: jest.Mock
  track: jest.Mock
  send: jest.Mock
  presenceState: jest.Mock
}
const channelMock: ChannelMock = {
  on: jest.fn((type: string, filter: { event?: string; table?: string }, cb: Handler) => {
    handlers.push({ type, filter, cb })
    return channelMock
  }),
  subscribe: jest.fn((cb: (status: string) => void) => {
    Promise.resolve().then(() => cb('SUBSCRIBED'))
    return channelMock
  }),
  track: jest.fn(() => Promise.resolve()),
  send: jest.fn(() => Promise.resolve('ok')),
  presenceState: jest.fn(() => ({})),
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => channelMock,
    removeChannel: jest.fn(),
    from: () => { throw new Error('unexpected query') },
    storage: { from: () => ({ createSignedUrl: jest.fn() }) },
  }),
}))

const ME = 'coach-1'
const P1 = 'player-1'
const P2 = 'player-2'
const member = (id: string, name: string) => ({ user_id: id, users: { id, name, avatar_url: null } })

const msg = (id: string, sender: string, created_at: string, body = 'hi') => ({
  id, sender_id: sender, body, attachment_url: null, attachment_kind: null, created_at, reply_to_id: null, poll_id: null,
})

function fire(type: string, event: string, payload: unknown) {
  for (const h of handlers) if (h.type === type && h.filter.event === event) h.cb(payload)
}

beforeEach(() => {
  handlers.length = 0
  channelMock.send.mockClear()
  ;(markRead as jest.Mock).mockClear()
})

describe('read receipts — DM', () => {
  function renderDm(lastRead: Record<string, string>) {
    return render(
      <ChatThread
        roomId="dm-1"
        roomKind="dm"
        currentUserId={ME}
        members={[member(ME, 'Coach'), member(P1, 'Chaid')]}
        initialMessages={[msg('m1', ME, '2026-09-29T11:00:00Z'), msg('m2', ME, '2026-09-29T11:30:00Z')]}
        receiptMode="dm"
        initialLastRead={lastRead}
      />,
    )
  }

  it('shows read ticks up to the other person\'s last read, sent ticks after', async () => {
    await act(async () => { renderDm({ [P1]: '2026-09-29T11:10:00Z' }) })
    expect(screen.getAllByTestId('receipt-read')).toHaveLength(1)
    expect(screen.getAllByTestId('receipt-sent')).toHaveLength(1)
  })

  it('turns ticks read live when a read broadcast arrives', async () => {
    await act(async () => { renderDm({}) })
    expect(screen.queryAllByTestId('receipt-read')).toHaveLength(0)
    await act(async () => { fire('broadcast', 'read', { payload: { userId: P1, at: '2026-09-29T11:31:00Z' } }) })
    expect(screen.getAllByTestId('receipt-read')).toHaveLength(2)
  })

  it('treats a reply from the other person as having read everything before it', async () => {
    await act(async () => { renderDm({}) })
    await act(async () => {
      fire('postgres_changes', 'INSERT', { new: msg('m3', P1, '2026-09-29T11:45:00Z', 'ok') })
    })
    expect(screen.getAllByTestId('receipt-read')).toHaveLength(2)
  })

  it('broadcasts its own read time once subscribed', async () => {
    await act(async () => { renderDm({}) })
    expect(markRead).toHaveBeenCalledWith('dm-1')
    expect(channelMock.send).toHaveBeenCalledWith({
      type: 'broadcast', event: 'read', payload: { userId: ME, at: '2026-09-29T12:00:00.000Z' },
    })
  })
})

describe('read receipts — group rooms', () => {
  const members = [member(ME, 'Coach'), member(P1, 'Chaid'), member(P2, 'Lewis')]
  const messages = [msg('m1', ME, '2026-09-29T11:00:00Z')]

  it('shows staff a seen count with names on tap', async () => {
    await act(async () => {
      render(<ChatThread roomId="g" roomKind="squad" currentUserId={ME} members={members}
        initialMessages={messages} receiptMode="group" initialLastRead={{ [P1]: '2026-09-29T11:05:00Z' }} />)
    })
    const btn = screen.getByRole('button', { name: 'Seen by 1 of 2' })
    fireEvent.click(btn)
    expect(screen.getByRole('dialog')).toHaveTextContent('Chaid')
    expect(screen.getByRole('dialog')).toHaveTextContent('Not yet (1)')
    expect(screen.getByRole('dialog')).toHaveTextContent('Lewis')
  })

  it('shows players nothing', async () => {
    await act(async () => {
      render(<ChatThread roomId="g" roomKind="squad" currentUserId={ME} members={members}
        initialMessages={messages} receiptMode="none" />)
    })
    expect(screen.queryByRole('button', { name: /Seen by/ })).toBeNull()
    expect(screen.queryByTestId('receipt-sent')).toBeNull()
  })
})

describe('day dividers', () => {
  it('adds a divider when the London day changes', async () => {
    await act(async () => {
      render(<ChatThread roomId="g" roomKind="squad" currentUserId={ME} members={[member(ME, 'Coach')]}
        initialMessages={[
          msg('a', ME, '2026-09-20T10:00:00Z'),
          msg('b', ME, '2026-09-20T11:00:00Z'),
          msg('c', ME, '2026-09-21T10:00:00Z'),
        ]} />)
    })
    expect(screen.getAllByTestId('day-divider')).toHaveLength(2)
  })
})
