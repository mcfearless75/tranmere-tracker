/**
 * Server-component tests for app/chat/[roomId]/page.tsx.
 *
 * The page runs every one of its lookups through the ADMIN client, which
 * bypasses RLS completely. Two of the ids it looks things up by —
 * `reply_to_id` and `poll_id` — are attacker-controlled: migration 011's
 * insert policy on chat_messages checks only room membership and sender_id,
 * and its update policy has no WITH CHECK at all, so a sender can point
 * their own message's reply_to_id at any message id in the database.
 *
 * These tests assert the room constraint that stops that: a message id or a
 * poll id belonging to another room must contribute nothing to this page.
 */
import ChatRoomPage from '@/app/chat/[roomId]/page'
import { ChatThread } from '@/app/chat/[roomId]/ChatThread'

type Recorded = { table: string; ops: Array<{ op: string; args: unknown[] }> }

let recorded: Recorded[] = []
let queues: Record<string, Array<{ data: unknown }>> = {}

function nextResult(table: string): { data: unknown } {
  const queue = queues[table]
  if (queue && queue.length) return queue.shift()!
  return { data: [] }
}

/** A chainable, awaitable stand-in for a PostgREST query builder that records
 *  every operation applied to it, so a test can assert on the query that was
 *  actually built rather than on its result. */
function makeBuilder(table: string) {
  const rec: Recorded = { table, ops: [] }
  recorded.push(rec)
  const result = nextResult(table)
  const proxy: Record<string, unknown> = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'then') {
        return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
          Promise.resolve({ ...result, error: null }).then(res, rej)
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => {
          rec.ops.push({ op: prop, args: [] })
          const data = result.data
          return Promise.resolve({
            data: Array.isArray(data) ? (data[0] ?? null) : data,
            error: null,
          })
        }
      }
      return (...args: unknown[]) => {
        rec.ops.push({ op: prop, args })
        return proxy
      }
    },
  }) as Record<string, unknown>
  return proxy
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'student-1' } } }) },
  }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (table: string) => makeBuilder(table) }),
}))

jest.mock('next/navigation', () => ({
  redirect: () => { throw new Error('redirected') },
  notFound: () => { throw new Error('notFound') },
}))

jest.mock('@/app/chat/[roomId]/ChatThread', () => ({
  ChatThread: () => null,
}))
jest.mock('@/app/chat/[roomId]/GroupMembers', () => ({ GroupMembers: () => null }))
jest.mock('@/app/chat/[roomId]/AddGroupMembers', () => ({ AddGroupMembers: () => null }))

const room = { id: 'room-1', kind: 'custom', name: 'Year 1', sync_year_group: null }

function student(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 'student-1',
    role: 'member',
    users: { id: 'student-1', name: 'Alfie', avatar_url: null, role: 'student', is_active: true, ...overrides },
  }
}

/** The page is a server component: it RETURNS an element tree, it does not
 *  render it, so the props handed to ChatThread have to be read off that
 *  tree rather than captured from a call. */
function findProps(node: unknown, type: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProps(child, type)
      if (found) return found
    }
    return null
  }
  const el = node as { type?: unknown; props?: { children?: unknown } }
  if (el.type === type) return (el.props ?? {}) as Record<string, unknown>
  return findProps(el.props?.children, type)
}

let threadProps: Record<string, unknown> | null = null

async function runPage() {
  const tree = await ChatRoomPage({ params: { roomId: 'room-1' } })
  threadProps = findProps(tree, ChatThread)
  return tree
}

function opsFor(table: string, index = 0) {
  return recorded.filter(r => r.table === table)[index]?.ops ?? []
}

function hasOp(ops: Array<{ op: string; args: unknown[] }>, op: string, args: unknown[]) {
  return ops.some(o => o.op === op && JSON.stringify(o.args) === JSON.stringify(args))
}

beforeEach(() => {
  recorded = []
  queues = {}
  threadProps = null
})

describe('ChatRoomPage admin-client lookups', () => {
  it('constrains the reply-parent lookup to this room, and renders nothing for a parent elsewhere', async () => {
    queues = {
      chat_rooms: [{ data: [room] }],
      chat_members: [{ data: [student()] }],
      chat_messages: [
        // The loaded window: one message pointing at an id from a private DM.
        { data: [{ id: 'm1', sender_id: 'student-1', body: 'look', attachment_url: null, attachment_kind: null, created_at: '2026-09-21T17:00:00.000Z', reply_to_id: 'dm-secret', poll_id: null }] },
        // The parent lookup, once room-constrained, finds nothing.
        { data: [] },
      ],
    }

    await runPage()

    const parentOps = opsFor('chat_messages', 1)
    expect(hasOp(parentOps, 'in', ['id', ['dm-secret']])).toBe(true)
    expect(hasOp(parentOps, 'eq', ['room_id', 'room-1'])).toBe(true)
    // poll_id is selected too, so a quoted poll reads "Poll" not "deleted".
    expect(parentOps.find(o => o.op === 'select')?.args[0]).toContain('poll_id')

    // Nothing resolved. The message keeps its reply_to_id, so the bubble
    // renders ReplyQuote with a null parent — the "Message deleted" stub
    // (covered directly in ReplyQuote.test.tsx) rather than a broken quote.
    expect(threadProps?.initialReplyParents).toEqual([])
    expect((threadProps?.initialMessages as Array<{ reply_to_id: string }>)[0].reply_to_id).toBe('dm-secret')
  })

  it("does not fetch options or votes for a poll that belongs to another room", async () => {
    queues = {
      chat_rooms: [{ data: [room] }],
      chat_members: [{ data: [student()] }],
      chat_messages: [
        { data: [{ id: 'm1', sender_id: 'student-1', body: null, attachment_url: null, attachment_kind: null, created_at: '2026-09-21T17:00:00.000Z', reply_to_id: null, poll_id: 'other-room-poll' }] },
      ],
      // Room-constrained, so the foreign poll does not come back.
      chat_polls: [{ data: [] }],
    }

    await runPage()

    const pollOps = opsFor('chat_polls')
    expect(hasOp(pollOps, 'in', ['id', ['other-room-poll']])).toBe(true)
    expect(hasOp(pollOps, 'eq', ['room_id', 'room-1'])).toBe(true)

    // The foreign poll's labels and live tallies are never even queried.
    expect(recorded.some(r => r.table === 'chat_poll_options')).toBe(false)
    expect(recorded.some(r => r.table === 'chat_poll_votes')).toBe(false)
    expect(threadProps?.initialPolls).toEqual([])
  })

  it('loads options and only the viewer\'s own votes for a poll that is in this room', async () => {
    const poll = { id: 'p1', room_id: 'room-1', created_by: 'u2', question: 'Q?', closed_at: null, created_at: '2026-09-21T17:00:00.000Z' }
    queues = {
      chat_rooms: [{ data: [room] }],
      chat_members: [{ data: [student()] }],
      chat_messages: [
        { data: [{ id: 'm1', sender_id: 'u2', body: null, attachment_url: null, attachment_kind: null, created_at: '2026-09-21T17:00:00.000Z', reply_to_id: null, poll_id: 'p1' }] },
      ],
      chat_polls: [{ data: [poll] }],
      chat_poll_options: [{ data: [{ id: 'o1', poll_id: 'p1', label: 'Yes', position: 0, vote_count: 0 }] }],
      chat_poll_votes: [{ data: [] }],
    }

    await runPage()

    expect(hasOp(opsFor('chat_poll_options'), 'in', ['poll_id', ['p1']])).toBe(true)
    // Layer 4 of the vote-privacy property: the admin client bypasses RLS, so
    // this query has to constrain itself to the viewer's own vote row.
    expect(hasOp(opsFor('chat_poll_votes'), 'eq', ['user_id', 'student-1'])).toBe(true)
    expect(threadProps?.initialPolls).toEqual([poll])
  })
})

describe('ChatRoomPage staff detection', () => {
  function runWith(viewer: Record<string, unknown>) {
    queues = {
      chat_rooms: [{ data: [{ ...room, kind: 'broadcast' }] }],
      chat_members: [{ data: [{ user_id: 'student-1', role: 'member', users: viewer }] }],
      chat_messages: [{ data: [] }],
    }
    return runPage()
  }

  it('treats an active coach as chat staff', async () => {
    await runWith({ id: 'student-1', name: 'Coach Phil', avatar_url: null, role: 'coach', is_active: true })
    expect(threadProps?.isChatStaff).toBe(true)
    expect(threadProps?.canSend).toBe(true)
  })

  // is_chat_staff() in migration 082 requires is_active = true. Without the
  // same clause here a deactivated coach is shown "New poll" and "Close
  // poll" controls that the database silently refuses.
  it('does not treat a deactivated coach as chat staff', async () => {
    await runWith({ id: 'student-1', name: 'Coach Phil', avatar_url: null, role: 'coach', is_active: false })
    expect(threadProps?.isChatStaff).toBe(false)
    expect(threadProps?.canSend).toBe(false)
  })

  it('does not treat a student as chat staff', async () => {
    await runWith({ id: 'student-1', name: 'Alfie', avatar_url: null, role: 'student', is_active: true })
    expect(threadProps?.isChatStaff).toBe(false)
  })
})
