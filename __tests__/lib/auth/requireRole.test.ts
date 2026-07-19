/**
 * @jest-environment node
 *
 * Unit tests for the centralised role guards used by every service-role
 * endpoint. The Supabase server and admin clients are mocked so the auth
 * matrix (unauthenticated, wrong role, right role) can be tested in isolation.
 */
const getUserMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: getUserMock } }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))

import { requireStaff, requireAdmin, requireStaffAction } from '@/lib/auth/requireRole'

function mockRole(role: string | null) {
  adminFromMock.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: role ? { role } : null, error: null }),
          }),
        }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })
}

beforeEach(() => {
  getUserMock.mockReset()
  adminFromMock.mockReset()
})

describe('requireStaff', () => {
  it('401 when unauthenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const r = await requireStaff()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
  })

  it('403 when the user has no profile row', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockRole(null)
    const r = await requireStaff()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('403 when the user is a student', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockRole('student')
    const r = await requireStaff()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it.each(['admin', 'coach', 'teacher'])('allows %s and returns context', async (role) => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockRole(role)
    const r = await requireStaff()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.ctx.role).toBe(role)
      expect(r.ctx.user.id).toBe('u1')
      expect(r.ctx.admin).toBeDefined()
    }
  })
})

describe('requireAdmin', () => {
  it('403 for a coach (staff but not admin)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockRole('coach')
    const r = await requireAdmin()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('allows admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockRole('admin')
    const r = await requireAdmin()
    expect(r.ok).toBe(true)
  })
})

describe('requireStaffAction', () => {
  it('throws when unauthenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    await expect(requireStaffAction()).rejects.toThrow('Unauthorised')
  })

  it('throws Forbidden for a student', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockRole('student')
    await expect(requireStaffAction()).rejects.toThrow('Forbidden')
  })

  it('returns context for staff', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockRole('coach')
    const ctx = await requireStaffAction()
    expect(ctx.role).toBe('coach')
    expect(ctx.user.id).toBe('u1')
  })
})
