/**
 * @jest-environment node
 *
 * Coverage for Task 7: createPoll and closePoll server actions.
 *
 * The user client is what enforces RLS (migration 082's staff-only insert
 * policy on chat_polls) — createPoll and closePoll must use it, not the
 * admin client, or the staff-only rule rests on a single `if` statement
 * instead of the database. These tests mock @/lib/supabase/server only, so
 * a switch to the admin client would leave `from` undefined and fail loudly.
 *
 * Note: the original task brief's test sketch mocked '@/lib/push', which
 * does not exist in this codebase. app/chat/actions.ts imports
 * sendPushNotification from '@/lib/webpush' and sendFcmBatch from
 * '@/lib/firebase-admin' — those are the two mocked below, matching the
 * shape used by replyNotification.test.ts and chatNativePush.test.ts.
 */
import { createPoll, closePoll } from '@/app/chat/actions'

const CURRENT_USER_ID = 'staff-1'

type MaybeError = { error: { message: string } | null }

const pollInsertMock = jest.fn()
const optionInsertMock = jest.fn<Promise<MaybeError>, [any?]>(() => Promise.resolve({ error: null }))
const messageInsertMock = jest.fn<Promise<MaybeError>, [any?]>(() => Promise.resolve({ error: null }))
const pollDeleteEqMock = jest.fn(() => Promise.resolve({ error: null }))
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
          delete: () => ({ eq: pollDeleteEqMock }),
          update: (row: any) => ({
            eq: () => ({
              select: () => ({ maybeSingle: () => pollUpdateMaybeSingleMock(row) }),
            }),
          }),
        }
      }
      if (table === 'chat_poll_options') return { insert: optionInsertMock }
      if (table === 'chat_messages') return { insert: messageInsertMock }
      throw new Error(`Unexpected table: ${table}`)
    },
  }),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/webpush', () => ({
  sendPushNotification: jest.fn(() => Promise.resolve()),
}))
jest.mock('@/lib/firebase-admin', () => ({
  sendFcmBatch: jest.fn(() => Promise.resolve({ sent: 0, failed: 0 })),
}))

const okPoll = { data: { id: 'poll-1' }, error: null }

describe('createPoll', () => {
  beforeEach(() => {
    pollInsertMock.mockReset().mockResolvedValue(okPoll)
    optionInsertMock.mockReset().mockResolvedValue({ error: null })
    messageInsertMock.mockReset().mockResolvedValue({ error: null })
    pollDeleteEqMock.mockClear()
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
    expect(result.ok).toBe(false)
    expect(pollDeleteEqMock).toHaveBeenCalledWith('id', 'poll-1')
    expect(messageInsertMock).not.toHaveBeenCalled()
  })

  it('rolls the poll back when the carrier message insert fails', async () => {
    messageInsertMock.mockResolvedValueOnce({ error: { message: 'boom' } })
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result.ok).toBe(false)
    expect(pollDeleteEqMock).toHaveBeenCalledWith('id', 'poll-1')
  })
})

describe('closePoll', () => {
  beforeEach(() => {
    pollUpdateMaybeSingleMock.mockReset()
  })

  it('closes the poll when the update policy allows it', async () => {
    pollUpdateMaybeSingleMock.mockResolvedValue({ data: { room_id: 'room-1' }, error: null })
    const result = await closePoll('poll-1')
    expect(result).toEqual({ ok: true })
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
