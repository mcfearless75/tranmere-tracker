/**
 * @jest-environment node
 *
 * Coverage for Task 7: createPoll and closePoll server actions.
 *
 * The user client is what enforces RLS (migration 082's staff-only insert
 * policy on chat_polls) — createPoll and closePoll must use it, not the
 * admin client, or the staff-only rule rests on a single `if` statement
 * instead of the database.
 *
 * Fix round 1 (Critical): migration 082 defines no DELETE policy on
 * chat_polls (only select/insert/update). Under RLS, a command with no
 * matching policy is denied for every row, silently — zero rows affected,
 * no error. So createPoll's rollback delete (cleaning up an orphaned poll
 * after the options or message insert fails) CANNOT go through the user
 * client — it would silently no-op. It must go through the admin client,
 * and only that one delete may. Everything else (poll/options/message
 * inserts, all of closePoll) must stay on the user client. The tests below
 * mock '@/lib/supabase/admin' separately from '@/lib/supabase/server' and
 * assert the rollback lands on the admin mock while inserts do not — this
 * is the regression guard for the whole finding.
 *
 * Note: the original task brief's test sketch mocked a nonexistent
 * '@/lib/push'. The real imports in app/chat/actions.ts are
 * sendPushNotification from '@/lib/webpush' and sendFcmBatch from
 * '@/lib/firebase-admin' — those are the two mocked below.
 */
import { createPoll, closePoll } from '@/app/chat/actions'

const CURRENT_USER_ID = 'staff-1'

type MaybeError = { error: { message: string } | null }

// ── User client (@/lib/supabase/server) ────────────────────────────────
// chat_polls deliberately has NO `delete` here. If createPoll's rollback
// were ever moved back onto the user client, calling `.delete()` on this
// mock throws (delete is not a function) and the relevant test fails loudly
// instead of silently no-opping the way the real RLS-less-policy bug did.
const pollInsertMock = jest.fn()
const optionInsertMock = jest.fn<Promise<MaybeError>, [any?]>(() => Promise.resolve({ error: null }))
const messageInsertMock = jest.fn<Promise<MaybeError>, [any?]>(() => Promise.resolve({ error: null }))
const pollUpdateMaybeSingleMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: CURRENT_USER_ID } } }) },
    from: (table: string) => {
      if (table === 'chat_polls') {
        return {
          insert: (row: any) => ({
            select: () => ({ single: () => pollInsertMock(row) }),
          }),
          update: (row: any) => ({
            eq: () => ({
              select: () => ({ maybeSingle: () => pollUpdateMaybeSingleMock(row) }),
            }),
          }),
        }
      }
      if (table === 'chat_poll_options') return { insert: optionInsertMock }
      if (table === 'chat_messages') return { insert: messageInsertMock }
      throw new Error(`Unexpected table on USER client: ${table}`)
    },
  }),
}))

// ── Admin client (@/lib/supabase/admin) ────────────────────────────────
// Used for exactly two things in this file's code path: (a) createPoll's
// rollback delete on chat_polls, and (b) notifyRoomMembers's own internal
// membership check on chat_members (notifyRoomMembers has always used the
// admin client — that's pre-existing, unrelated to this fix).
const pollDeleteEqMock = jest.fn<Promise<MaybeError>, [any?, any?]>(() => Promise.resolve({ error: null }))
let chatMembersLookupShouldReject = false

function makeChatMembersChain() {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    // isRoomMember's shape: .select().eq().eq().maybeSingle()
    maybeSingle: () => {
      if (chatMembersLookupShouldReject) return Promise.reject(new Error('chat_members lookup failed'))
      return Promise.resolve({ data: { user_id: CURRENT_USER_ID } })
    },
    // members-list shape: .select().eq().neq() — resolve with no other
    // members so notifyRoomMembers returns early, before touching
    // push_subscriptions/native_push_tokens/users (out of scope here).
    neq: () => Promise.resolve({ data: [] }),
  }
  return chain
}

const adminFrom = jest.fn((table: string) => {
  if (table === 'chat_polls') return { delete: () => ({ eq: pollDeleteEqMock }) }
  if (table === 'chat_members') return makeChatMembersChain()
  throw new Error(`Unexpected table on ADMIN client: ${table}`)
})

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFrom }),
}))

const revalidatePathMock = jest.fn()
jest.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }))

const sendPushNotificationMock = jest.fn((..._args: unknown[]) => Promise.resolve())
jest.mock('@/lib/webpush', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...args),
}))
const sendFcmBatchMock = jest.fn((..._args: unknown[]) => Promise.resolve({ sent: 0, failed: 0 }))
jest.mock('@/lib/firebase-admin', () => ({
  sendFcmBatch: (...args: unknown[]) => sendFcmBatchMock(...args),
}))

const okPoll = { data: { id: 'poll-1' }, error: null }

describe('createPoll', () => {
  beforeEach(() => {
    pollInsertMock.mockReset().mockResolvedValue(okPoll)
    optionInsertMock.mockReset().mockResolvedValue({ error: null })
    messageInsertMock.mockReset().mockResolvedValue({ error: null })
    pollDeleteEqMock.mockReset().mockResolvedValue({ error: null })
    adminFrom.mockClear()
    revalidatePathMock.mockClear()
    sendPushNotificationMock.mockClear()
    sendFcmBatchMock.mockClear()
    chatMembersLookupShouldReject = false
  })

  it('creates the poll, its options and the carrier message', async () => {
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result).toEqual({ ok: true })
    expect(optionInsertMock).toHaveBeenCalledWith([
      { poll_id: 'poll-1', label: 'Yes', position: 0 },
      { poll_id: 'poll-1', label: 'No', position: 1 },
    ])
    expect(messageInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ room_id: 'room-1', poll_id: 'poll-1', sender_id: CURRENT_USER_ID })
    )
  })

  it('trims and drops blank option rows before inserting', async () => {
    await createPoll('room-1', '  Who is coming?  ', ['  Yes  ', '', 'No', '   '])
    expect(optionInsertMock).toHaveBeenCalledWith([
      { poll_id: 'poll-1', label: 'Yes', position: 0 },
      { poll_id: 'poll-1', label: 'No', position: 1 },
    ])
  })

  it('rejects invalid input before touching the database', async () => {
    const result = await createPoll('room-1', '', ['Yes', 'No'])
    expect(result).toEqual({ ok: false, error: 'Add a question' })
    expect(pollInsertMock).not.toHaveBeenCalled()
  })

  it('surfaces an RLS rejection rather than reporting fake success', async () => {
    // What a student (or a non-member) gets back from the insert policy.
    pollInsertMock.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy' } })
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result.ok).toBe(false)
    expect(optionInsertMock).not.toHaveBeenCalled()
  })

  it('rolls the poll back when the options insert fails', async () => {
    optionInsertMock.mockResolvedValueOnce({ error: { message: 'boom' } })
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result).toEqual({ ok: false, error: 'boom' })
    expect(pollDeleteEqMock).toHaveBeenCalledWith('id', 'poll-1')
    expect(messageInsertMock).not.toHaveBeenCalled()
  })

  it('rolls the poll back when the carrier message insert fails', async () => {
    messageInsertMock.mockResolvedValueOnce({ error: { message: 'boom' } })
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result).toEqual({ ok: false, error: 'boom' })
    expect(pollDeleteEqMock).toHaveBeenCalledWith('id', 'poll-1')
  })

  // ── Regression guard: rollback must use the ADMIN client ──────────────
  it('issues the rollback delete through the ADMIN client, not the user client', async () => {
    optionInsertMock.mockResolvedValueOnce({ error: { message: 'boom' } })
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result.ok).toBe(false)
    // pollDeleteEqMock only exists on the admin mock's chat_polls().delete()
    // chain — its being called at all proves the delete went through the
    // admin client. The user client's chat_polls mock has no `delete`
    // method at all, so a wrong-client regression would throw instead of
    // reaching this assertion.
    expect(pollDeleteEqMock).toHaveBeenCalledWith('id', 'poll-1')
    expect(adminFrom).toHaveBeenCalledWith('chat_polls')
  })

  it('never routes the poll/options/message inserts through the admin client', async () => {
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result).toEqual({ ok: true })
    // On the happy path the only admin-client table touched is chat_members
    // (twice — notifyRoomMembers's own pre-existing, unrelated membership
    // check, then its other-members lookup) — chat_polls must never appear
    // here. If a future change moved the inserts onto the admin client, this
    // would start including 'chat_polls' or 'chat_poll_options' or
    // 'chat_messages' and fail.
    const tablesTouched = adminFrom.mock.calls.map(c => c[0])
    expect(tablesTouched).toEqual(['chat_members', 'chat_members'])
  })

  it('reports a failed rollback distinctly from a plain options-insert failure', async () => {
    optionInsertMock.mockResolvedValueOnce({ error: { message: 'boom' } })
    pollDeleteEqMock.mockResolvedValueOnce({ error: { message: 'delete blocked' } })
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result.ok).toBe(false)
    // Must not be the bare options-failure message a successful rollback
    // would report — the caller needs to know cleanup ALSO failed.
    expect(result.error).not.toBe('boom')
    expect(result.error).toEqual(expect.stringContaining('boom'))
    expect(result.error).toEqual(expect.stringContaining('delete blocked'))
  })

  it('does not report failure when notifyRoomMembers rejects after a successful create', async () => {
    chatMembersLookupShouldReject = true
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    // The poll, its options and the carrier message already exist by the
    // time notifyRoomMembers runs — a push-side failure must not turn that
    // into a reported failure.
    expect(result).toEqual({ ok: true })
    expect(adminFrom).toHaveBeenCalledWith('chat_members')
  })

  it('revalidates the room path on success', async () => {
    await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(revalidatePathMock).toHaveBeenCalledWith('/chat/room-1')
  })
})

describe('closePoll', () => {
  beforeEach(() => {
    pollUpdateMaybeSingleMock.mockReset()
    adminFrom.mockClear()
  })

  it('closes the poll when the update policy allows it', async () => {
    pollUpdateMaybeSingleMock.mockResolvedValue({ data: { room_id: 'room-1' }, error: null })
    const result = await closePoll('poll-1')
    expect(result).toEqual({ ok: true })
    // closePoll must never touch the admin client at all.
    expect(adminFrom).not.toHaveBeenCalled()
  })

  it('returns a clean error on zero rows instead of throwing (RLS-blocked update)', async () => {
    pollUpdateMaybeSingleMock.mockResolvedValue({ data: null, error: null })
    const result = await closePoll('poll-1')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('surfaces a real database error', async () => {
    pollUpdateMaybeSingleMock.mockResolvedValue({ data: null, error: { message: 'connection lost' } })
    const result = await closePoll('poll-1')
    expect(result).toEqual({ ok: false, error: 'connection lost' })
  })
})
