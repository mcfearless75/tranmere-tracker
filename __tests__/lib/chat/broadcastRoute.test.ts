/**
 * @jest-environment node
 *
 * Regression coverage for the "typed the whole announcement into the
 * channel-name field" bug reported live 2026-09-14 — twice. The create
 * form had no length limit, so staff who mistook the name field for the
 * message box ended up with a broadcast channel whose "name" was a full
 * paragraph and no actual message ever posted. This caps `name` server-side
 * too (CreateBroadcastForm already caps it client-side), so a direct API
 * call can't recreate the same confusion.
 */
import { NextRequest } from 'next/server'

const STAFF_USER_ID = 'staff-1'

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: STAFF_USER_ID } } }) },
  }),
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/broadcast', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeAdminMock(opts: { role?: string; roomInsertError?: { message: string } | null } = {}) {
  const { role = 'admin', roomInsertError = null } = opts

  const profileSingle = jest.fn(() => Promise.resolve({ data: { role }, error: null }))
  const profileEq = jest.fn(() => ({ single: profileSingle }))
  const profileSelect = jest.fn(() => ({ eq: profileEq }))

  const roomInsertSingle = jest.fn(() =>
    Promise.resolve(
      roomInsertError ? { data: null, error: roomInsertError } : { data: { id: 'room-1' }, error: null },
    ),
  )
  const roomInsertSelect = jest.fn(() => ({ single: roomInsertSingle }))
  const roomInsert = jest.fn(() => ({ select: roomInsertSelect }))

  const activeUsersEq = jest.fn(() => Promise.resolve({ data: [{ id: STAFF_USER_ID, role: 'admin' }] }))
  const activeUsersSelect = jest.fn(() => ({ eq: activeUsersEq }))

  const membersInsert = jest.fn(() => Promise.resolve({ error: null }))

  let usersCallCount = 0
  const from = jest.fn((table: string) => {
    if (table === 'users') {
      usersCallCount += 1
      // First call is the requester's own profile/role check; second is the
      // active-user roster for auto-membership.
      return usersCallCount === 1 ? { select: profileSelect } : { select: activeUsersSelect }
    }
    if (table === 'chat_rooms') return { insert: roomInsert }
    if (table === 'chat_members') return { insert: membersInsert }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from, roomInsert, membersInsert }
}

describe('POST /api/admin/broadcast', () => {
  it('rejects a name over 60 characters and never creates the room', async () => {
    const admin = makeAdminMock()
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { POST } = await import('@/app/api/admin/broadcast/route')

    const longName = 'A'.repeat(61)
    const res = await POST(makeRequest({ name: longName }))

    expect(res.status).toBe(400)
    expect(admin.roomInsert).not.toHaveBeenCalled()
  })

  it('creates the room when the name is 60 characters or fewer', async () => {
    const admin = makeAdminMock()
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { POST } = await import('@/app/api/admin/broadcast/route')

    const res = await POST(makeRequest({ name: 'Season Update' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.roomId).toBe('room-1')
    expect(admin.roomInsert).toHaveBeenCalledTimes(1)
  })

  it('returns 403 for a non-staff caller', async () => {
    const admin = makeAdminMock({ role: 'student' })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { POST } = await import('@/app/api/admin/broadcast/route')

    const res = await POST(makeRequest({ name: 'Season Update' }))

    expect(res.status).toBe(403)
    expect(admin.roomInsert).not.toHaveBeenCalled()
  })
})
