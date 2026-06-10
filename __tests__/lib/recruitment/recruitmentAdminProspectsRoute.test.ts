/**
 * @jest-environment node
 *
 * Unit tests for the recruitment prospect status PATCH handler.
 * Runs in the node environment so the Web Request/Response globals used by
 * NextRequest are available (jsdom does not provide them).
 * The Supabase server/admin clients and recruitmentUtils are mocked so the
 * handler logic (staff auth gate, status validation, update) can be tested
 * in isolation without a live database.
 */
import { NextRequest } from 'next/server'

const getUserMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
  }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: adminFromMock,
  }),
}))

jest.mock('@/lib/recruitment/recruitmentUtils', () => ({
  PROSPECT_STATUSES: ['new', 'reviewing', 'invited', 'trialled', 'offered', 'signed', 'rejected'],
}))

import { PATCH } from '@/app/api/recruitment/prospects/[prospectId]/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/recruitment/prospects/p1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const params = { params: { prospectId: 'p1' } }

/** Builds the admin .from() router used by the handler. */
function setupAdmin(opts: {
  role?: string | null
  prospectExists?: boolean
  updateError?: { message: string } | null
}) {
  const { role = 'admin', prospectExists = true, updateError = null } = opts

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
    if (table === 'recruitment_prospects') {
      return {
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () =>
                updateError
                  ? { data: null, error: updateError }
                  : {
                      data: prospectExists ? { id: 'p1', status: 'reviewing' } : null,
                      error: null,
                    },
            }),
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

describe('PATCH /api/recruitment/prospects/[prospectId]', () => {
  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    setupAdmin({})
    const res = await PATCH(makeRequest({ status: 'reviewing' }), params)
    expect(res.status).toBe(401)
  })

  it('returns 401 when the user is not staff', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ role: 'student' })
    const res = await PATCH(makeRequest({ status: 'reviewing' }), params)
    expect(res.status).toBe(401)
  })

  it('allows a coach through the staff gate', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ role: 'coach' })
    const res = await PATCH(makeRequest({ status: 'reviewing' }), params)
    expect(res.status).toBe(200)
  })

  it('returns 400 for an invalid status', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({})
    const res = await PATCH(makeRequest({ status: 'promoted' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 404 when the prospect does not exist', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ prospectExists: false })
    const res = await PATCH(makeRequest({ status: 'invited' }), params)
    expect(res.status).toBe(404)
  })

  it('updates the status and returns the prospect for a valid staff request', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({})
    const res = await PATCH(makeRequest({ status: 'reviewing' }), params)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.prospect).toEqual({ id: 'p1', status: 'reviewing' })
  })

  it('returns 500 when the update fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ updateError: { message: 'db down' } })
    const res = await PATCH(makeRequest({ status: 'reviewing' }), params)
    expect(res.status).toBe(500)
  })
})
