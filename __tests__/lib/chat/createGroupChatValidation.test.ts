/**
 * @jest-environment node
 *
 * Regression coverage for the "whole announcement typed into the name
 * field" bug — already hit twice for broadcast channels (2026-09-14,
 * commit 11ed0ca) and fixed there with a 60-char cap on both the client
 * form and the server action. createGroupChat has the identical shape
 * (a name field right next to a Create button, no length limit), so it
 * gets the same server-side floor here before the same mistake recurs
 * on the group-chat side.
 */
const STAFF_USER_ID = 'staff-1'

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: STAFF_USER_ID } } }) },
  }),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

function makeAdminMock() {
  // First .from('users') call is the staff-role check (.select().eq().maybeSingle());
  // the second is the candidates lookup (.select().in().neq().eq()), reached
  // only once a name passes the length check.
  const roleMaybeSingle = jest.fn(() => Promise.resolve({ data: { role: 'coach' } }))
  const roleEq = jest.fn(() => ({ maybeSingle: roleMaybeSingle }))
  const roleSelect = jest.fn(() => ({ eq: roleEq }))

  const candidatesEq = jest.fn(() => Promise.resolve({ data: [] }))
  const candidatesNeq = jest.fn(() => ({ eq: candidatesEq }))
  const candidatesIn = jest.fn(() => ({ neq: candidatesNeq }))
  const candidatesSelect = jest.fn(() => ({ in: candidatesIn }))

  const roomInsertSingle = jest.fn(() => Promise.resolve({ data: { id: 'room-1' }, error: null }))
  const roomInsertSelect = jest.fn(() => ({ single: roomInsertSingle }))
  const roomInsert = jest.fn(() => ({ select: roomInsertSelect }))

  let usersCallCount = 0
  const from = jest.fn((table: string) => {
    if (table === 'users') {
      usersCallCount += 1
      return usersCallCount === 1 ? { select: roleSelect } : { select: candidatesSelect }
    }
    if (table === 'chat_rooms') return { insert: roomInsert }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from, roomInsert }
}

describe('createGroupChat — name length validation', () => {
  it('rejects a name over 60 characters and never creates the room', async () => {
    const admin = makeAdminMock()
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { createGroupChat } = await import('@/app/chat/actions')

    const result = await createGroupChat('A'.repeat(61), ['other-user'])

    expect(result).toEqual({ error: 'Group name must be 60 characters or fewer' })
    expect(admin.roomInsert).not.toHaveBeenCalled()
  })

  it('accepts a name of exactly 60 characters (gets past the length check)', async () => {
    const admin = makeAdminMock()
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { createGroupChat } = await import('@/app/chat/actions')

    // The mock's candidates lookup returns no rows, so this correctly ends
    // at "Pick at least one member" rather than the length-check error —
    // proof the 60-char name cleared that check and reached the next step.
    const result = await createGroupChat('A'.repeat(60), ['other-user'])

    expect(result).toEqual({ error: 'Pick at least one member' })
    expect(admin.roomInsert).not.toHaveBeenCalled()
  })
})
