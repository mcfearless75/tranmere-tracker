/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { POST } from '@/app/api/admin/create-user/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/create-user', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return { username: 'javanm', name: 'Javan Moussa', role: 'student', pin: '123456' }
}

function setupAdmin(options: { existingAuth?: { id: string } | null } = {}) {
  const { existingAuth = null } = options

  const listUsersMock = jest.fn(async () => ({
    data: { users: existingAuth ? [{ id: existingAuth.id, email: 'javanm@tranmeretracker.internal' }] : [] },
  }))
  const createUserMock = jest.fn(async () => ({
    data: { user: { id: 'new-user-1' } },
    error: null,
  }))
  const updateUserByIdMock = jest.fn(async () => ({ data: {}, error: null }))
  const deleteUserMock = jest.fn(async () => ({ error: null }))

  const profileMaybeSingleMock = jest.fn(async () => ({ data: null, error: null })) // no existing profile row -> orphan-recovery branch when existingAuth is set
  const profileEqMock = jest.fn(() => ({ maybeSingle: profileMaybeSingleMock }))
  const profileSelectMock = jest.fn(() => ({ eq: profileEqMock }))

  const upsertMock = jest.fn(async () => ({ error: null }))

  const fromMock = jest.fn((table: string) => {
    if (table === 'users') return { select: profileSelectMock, upsert: upsertMock }
    throw new Error(`Unexpected table ${table}`)
  })

  const admin = {
    from: fromMock,
    auth: {
      admin: {
        listUsers: listUsersMock,
        createUser: createUserMock,
        updateUserById: updateUserByIdMock,
        deleteUser: deleteUserMock,
      },
    },
  }

  return { admin, upsertMock, createUserMock, updateUserByIdMock }
}

function authorizeAsAdmin(admin: unknown) {
  requireStaffMock.mockResolvedValue({ ok: true, ctx: { user: { id: 'staff-1' }, role: 'admin', admin } })
}

beforeEach(() => {
  requireStaffMock.mockReset()
})

describe('POST /api/admin/create-user', () => {
  it('flags a freshly created account to prompt a PIN change on first login', async () => {
    const { admin, upsertMock } = setupAdmin()
    authorizeAsAdmin(admin)

    const res = await POST(makeRequest(validBody()))
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ must_change_pin: true }),
    )
  })

  it('flags a recovered orphaned account to prompt a PIN change too', async () => {
    const { admin, upsertMock } = setupAdmin({ existingAuth: { id: 'orphan-1' } })
    authorizeAsAdmin(admin)

    const res = await POST(makeRequest(validBody()))
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.recovered).toBe(true)
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'orphan-1', must_change_pin: true }),
    )
  })

  it('still rejects a malformed PIN before touching the admin client', async () => {
    const { admin, createUserMock } = setupAdmin()
    authorizeAsAdmin(admin)

    const res = await POST(makeRequest({ ...validBody(), pin: 'abc' }))
    expect(res.status).toBe(400)
    expect(createUserMock).not.toHaveBeenCalled()
  })
})
