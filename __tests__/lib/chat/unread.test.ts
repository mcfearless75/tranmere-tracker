import { getUnreadSummary, messagePreview, roomsWithActivity, PREVIEW_MAX } from '@/lib/chat/unread'
import { badgeLabel, isChatListPath, shouldShowBanner, viewingRoomFrom } from '@/lib/chat/bannerLogic'
import type { SupabaseClient } from '@supabase/supabase-js'

const ROOM_A = '11111111-1111-4111-8111-111111111111'
const ROOM_B = '22222222-2222-4222-8222-222222222222'
const ME = 'me'

describe('messagePreview', () => {
  it('uses the body, collapsed to one line and truncated', () => {
    expect(messagePreview({ body: 'Training\n  moved to 3pm', attachment_kind: null, poll_id: null })).toBe('Training moved to 3pm')
    const long = messagePreview({ body: 'x'.repeat(200), attachment_kind: null, poll_id: null })
    expect(long).toHaveLength(PREVIEW_MAX)
    expect(long.endsWith('…')).toBe(true)
  })

  it('labels polls, photos and files that have no text', () => {
    expect(messagePreview({ body: null, attachment_kind: null, poll_id: 'p1' })).toBe('📊 Poll')
    expect(messagePreview({ body: null, attachment_kind: 'image', poll_id: null })).toBe('📷 Photo')
    expect(messagePreview({ body: '', attachment_kind: 'file', poll_id: null })).toBe('📎 Attachment')
  })
})

describe('roomsWithActivity', () => {
  const room = (id: string, last: string | null) => ({ id, kind: 'squad', name: 'Squad', last_message_at: last })
  it('keeps rooms with a message after last read, never the room on screen', () => {
    const memberships = [
      { room_id: ROOM_A, last_read_at: '2026-09-28T10:00:00Z', chat_rooms: room(ROOM_A, '2026-09-28T11:00:00Z') },
      { room_id: ROOM_B, last_read_at: '2026-09-28T12:00:00Z', chat_rooms: room(ROOM_B, '2026-09-28T11:00:00Z') },
    ]
    expect(roomsWithActivity(memberships, null).map(m => m.room_id)).toEqual([ROOM_A])
    expect(roomsWithActivity(memberships, ROOM_A)).toEqual([])
  })
})

describe('viewingRoomFrom', () => {
  it('reads the room id from a chat room path only', () => {
    expect(viewingRoomFrom(`/chat/${ROOM_A}`)).toBe(ROOM_A)
    expect(viewingRoomFrom(`/chat/${ROOM_A}/info`)).toBe(ROOM_A)
    expect(viewingRoomFrom('/chat')).toBeNull()
    expect(viewingRoomFrom('/dashboard')).toBeNull()
    expect(viewingRoomFrom(null)).toBeNull()
  })
})

describe('shouldShowBanner', () => {
  const latest = { id: 'm1', roomId: ROOM_A, roomLabel: 'Squad', senderName: 'Coach', preview: 'hi', createdAt: '' }
  const base = { latest, fromArrival: true, lastShownId: null, viewingRoomId: null, suppressed: false }
  it('shows a newly arrived message', () => {
    expect(shouldShowBanner(base)).toBe(true)
  })
  it('never pops for messages already waiting when the app opened', () => {
    expect(shouldShowBanner({ ...base, fromArrival: false })).toBe(false)
  })
  it('does not repeat, does not show for the open room, and respects suppression', () => {
    expect(shouldShowBanner({ ...base, lastShownId: 'm1' })).toBe(false)
    expect(shouldShowBanner({ ...base, viewingRoomId: ROOM_A })).toBe(false)
    expect(shouldShowBanner({ ...base, suppressed: true })).toBe(false)
    expect(shouldShowBanner({ ...base, latest: null })).toBe(false)
  })
})

describe('isChatListPath', () => {
  it('matches only the two chat list pages', () => {
    expect(isChatListPath('/chat')).toBe(true)
    expect(isChatListPath('/parent/messages')).toBe(true)
    expect(isChatListPath(`/chat/${ROOM_A}`)).toBe(false)
    expect(isChatListPath('/dashboard')).toBe(false)
  })
})

describe('badgeLabel', () => {
  it('hides at zero and caps at 99+', () => {
    expect(badgeLabel(0)).toBeNull()
    expect(badgeLabel(7)).toBe('7')
    expect(badgeLabel(150)).toBe('99+')
  })
})

// ── getUnreadSummary against a fake PostgREST client ────────────────────────

type Call = { table: string; ops: [string, unknown[]][] }

function fakeAdmin(resolve: (c: Call) => { data: unknown; count?: number; error?: unknown }) {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    calls.push(call)
    const chain: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'neq', 'gt', 'is', 'order', 'limit', 'maybeSingle']) {
      chain[op] = (...args: unknown[]) => { call.ops.push([op, args]); return chain }
    }
    chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
      Promise.resolve({ error: null, ...resolve(call) }).then(ok, bad)
    return chain
  }
  return { client: { from } as unknown as SupabaseClient, calls }
}

const has = (c: Call, op: string, ...args: unknown[]) =>
  c.ops.some(([o, a]) => o === op && JSON.stringify(a.slice(0, args.length)) === JSON.stringify(args))

describe('getUnreadSummary', () => {
  const memberships = [
    { room_id: ROOM_A, last_read_at: '2026-09-28T10:00:00Z', chat_rooms: { id: ROOM_A, kind: 'squad', name: 'Year 1', last_message_at: '2026-09-28T12:00:00Z' } },
    { room_id: ROOM_B, last_read_at: '2026-09-28T10:00:00Z', chat_rooms: { id: ROOM_B, kind: 'dm', name: null, last_message_at: '2026-09-28T12:30:00Z' } },
  ]

  function scenario() {
    return fakeAdmin(c => {
      if (c.table === 'chat_members' && has(c, 'eq', 'user_id', ME)) return { data: memberships }
      if (c.table === 'chat_messages' && has(c, 'eq', 'room_id', ROOM_A)) {
        return { count: 3, data: [{ id: 'a3', room_id: ROOM_A, sender_id: 'coach', body: 'Kit on', attachment_kind: null, poll_id: null, created_at: '2026-09-28T12:00:00Z' }] }
      }
      if (c.table === 'chat_messages' && has(c, 'eq', 'room_id', ROOM_B)) {
        return { count: 2, data: [{ id: 'b2', room_id: ROOM_B, sender_id: 'jo', body: 'You in?', attachment_kind: null, poll_id: null, created_at: '2026-09-28T12:30:00Z' }] }
      }
      if (c.table === 'users') return { data: { name: 'Jo Bloggs' } }
      if (c.table === 'chat_members') return { data: { users: { name: 'Jo Bloggs' } } }
      return { data: null }
    })
  }

  it('totals unread across rooms and returns the newest, with DM label', async () => {
    const { client } = scenario()
    const s = await getUnreadSummary(client, ME, null)
    expect(s.total).toBe(5)
    expect(s.latest).toMatchObject({ id: 'b2', roomId: ROOM_B, senderName: 'Jo Bloggs', roomLabel: 'Jo Bloggs', preview: 'You in?' })
  })

  it('only counts other people\'s undeleted messages after last read', async () => {
    const { client, calls } = scenario()
    await getUnreadSummary(client, ME, null)
    const q = calls.find(c => c.table === 'chat_messages' && has(c, 'eq', 'room_id', ROOM_A))!
    expect(has(q, 'neq', 'sender_id', ME)).toBe(true)
    expect(has(q, 'gt', 'created_at', '2026-09-28T10:00:00Z')).toBe(true)
    expect(has(q, 'is', 'deleted_at', null)).toBe(true)
  })

  it('leaves out the room on screen', async () => {
    const { client } = scenario()
    const s = await getUnreadSummary(client, ME, ROOM_B)
    expect(s.total).toBe(3)
    expect(s.latest).toMatchObject({ id: 'a3', roomLabel: 'Year 1', senderName: 'Jo Bloggs' })
  })

  it('is zero with no active rooms, without querying messages', async () => {
    const { client, calls } = fakeAdmin(() => ({ data: [] }))
    expect(await getUnreadSummary(client, ME, null)).toEqual({ total: 0, latest: null })
    expect(calls.some(c => c.table === 'chat_messages')).toBe(false)
  })

  it('throws when the membership query fails', async () => {
    const { client } = fakeAdmin(() => ({ data: null, error: new Error('boom') }))
    await expect(getUnreadSummary(client, ME, null)).rejects.toThrow('boom')
  })
})
