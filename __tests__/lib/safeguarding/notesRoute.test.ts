/**
 * @jest-environment node
 *
 * Unit tests for the safeguarding notes API handler.
 * Runs in the node environment so the Web Request/Response globals used by
 * NextRequest are available (jsdom does not provide them).
 * The Supabase server and admin clients are mocked so the handler logic
 * (auth gate, validation, concern existence check, insert) can be tested
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

import { POST } from '@/app/api/safeguarding/[concernId]/notes/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/safeguarding/c1/notes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const params = { params: { concernId: 'c1' } }

/** Builds the admin .from() router used by the handler. */
function setupAdmin(opts: {
  role?: string | null
  concernExists?: boolean
  insertError?: { message: string } | null
}) {
  const { role = 'admin', concernExists = true, insertError = null } = opts

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
    if (table === 'safeguarding_concerns') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: concernExists ? { id: 'c1' } : null, error: null }),
          }),
        }),
      }
    }
    if (table === 'safeguarding_notes') {
      return {
        insert: () => ({
          select: () => ({
            single: async () =>
              insertError
                ? { data: null, error: insertError }
                : { data: { id: 'note-1', concern_id: 'c1', note: 'hello' }, error: null },
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

describe('POST /api/safeguarding/[concernId]/notes', () => {
  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    setupAdmin({})
    const res = await POST(makeRequest({ note: 'hi' }), params)
    expect(res.status).toBe(401)
  })

  it('returns 401 when the user is not an admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ role: 'student' })
    const res = await POST(makeRequest({ note: 'hi' }), params)
    expect(res.status).toBe(401)
  })

  it('returns 400 when the note is missing', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({})
    const res = await POST(makeRequest({ note: '   ' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 404 when the concern does not exist', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ concernExists: false })
    const res = await POST(makeRequest({ note: 'valid note' }), params)
    expect(res.status).toBe(404)
  })

  it('creates a note and returns 201 for a valid admin request', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({})
    const res = await POST(makeRequest({ note: 'A safeguarding note' }), params)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.note).toEqual({ id: 'note-1', concern_id: 'c1', note: 'hello' })
  })

  it('returns 500 when the insert fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ insertError: { message: 'db down' } })
    const res = await POST(makeRequest({ note: 'A note' }), params)
    expect(res.status).toBe(500)
  })
})
