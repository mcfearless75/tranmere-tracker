/**
 * @jest-environment node
 *
 * Unit tests for the youth player create (POST) handler.
 * Runs in the node environment so the Web Request/Response globals used by
 * NextRequest are available (jsdom does not provide them).
 * The Supabase server/admin clients are mocked so the handler logic
 * (staff auth gate, validation, squad lookup, insert) can be tested in
 * isolation without a live database.
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

import { POST } from '@/app/api/youth/players/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/youth/players', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    squad_id: 's1',
    first_name: 'Sam',
    last_name: 'Jones',
    date_of_birth: `${new Date().getUTCFullYear() - 10}-01-01`,
    parent_guardian_name: 'Alex Jones',
    parent_contact_email: 'alex.jones@example.com',
    parent_contact_phone: '0151 000 0000',
    consent_given: true,
  }
}

/** Builds the admin .from() router used by the handler. */
function setupAdmin(opts: { role?: string | null; squadExists?: boolean } = {}) {
  const { role = 'admin', squadExists = true } = opts

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
    if (table === 'youth_squads') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: squadExists ? { id: 's1' } : null, error: null }),
          }),
        }),
      }
    }
    if (table === 'youth_players') {
      return {
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => ({ data: { id: 'p1', ...row }, error: null }),
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

describe('POST /api/youth/players', () => {
  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    setupAdmin()
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(401)
  })

  it('returns 401 when the user is not staff', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ role: 'student' })
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(401)
  })

  it('allows a coach through the staff gate', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ role: 'coach' })
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(201)
  })

  it('returns 400 when consent has not been given', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin()
    const res = await POST(makeRequest({ ...validBody(), consent_given: false }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid parent contact email', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin()
    const res = await POST(makeRequest({ ...validBody(), parent_contact_email: 'nope' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the squad does not exist', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ squadExists: false })
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(404)
  })

  it('creates the player and returns 201 for a valid staff request', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin()
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.player.id).toBe('p1')
    expect(json.player.squad_id).toBe('s1')
    expect(json.player.consent_given).toBe(true)
  })
})
