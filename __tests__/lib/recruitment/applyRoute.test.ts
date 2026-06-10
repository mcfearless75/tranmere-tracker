/**
 * @jest-environment node
 *
 * Unit tests for the PUBLIC trial application POST handler.
 * Runs in the node environment so the Web Request/Response globals used by
 * NextRequest are available (jsdom does not provide them).
 * Only the Supabase admin client is mocked — the real validateApplication
 * from recruitmentUtils runs, so the server-side validation gate is exercised
 * for real. The route is public, so no auth mocks are needed at all.
 */
import { NextRequest } from 'next/server'

const insertMock = jest.fn()
const adminFromMock = jest.fn(() => ({ insert: insertMock }))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: adminFromMock,
  }),
}))

import { POST } from '@/app/api/recruitment/apply/route'

/** Date of birth ~15 years ago, always inside the 10-21 eligibility window. */
function eligibleDob(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 15)
  return d.toISOString().split('T')[0]
}

function validApplication(overrides: Record<string, unknown> = {}) {
  return {
    first_name: 'Jamie',
    last_name: 'Carragher',
    date_of_birth: eligibleDob(),
    position: 'Defender',
    preferred_foot: 'right',
    current_club: 'Bootle JFC',
    contact_email: 'parent@example.com',
    contact_phone: '07000000000',
    parent_guardian_name: 'Pat Carragher',
    consent_given: true,
    notes: 'Plays Sunday league.',
    website: '',
    ...overrides,
  }
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/recruitment/apply', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  insertMock.mockReset()
  insertMock.mockResolvedValue({ error: null })
  adminFromMock.mockClear()
})

describe('POST /api/recruitment/apply', () => {
  it('accepts a valid application without any authentication (public endpoint)', async () => {
    const res = await POST(makeRequest(validApplication()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })
  })

  it('inserts the prospect with source public_form via the admin client', async () => {
    await POST(makeRequest(validApplication()))
    expect(adminFromMock).toHaveBeenCalledWith('recruitment_prospects')
    expect(insertMock).toHaveBeenCalledTimes(1)
    const payload = insertMock.mock.calls[0][0]
    expect(payload.source).toBe('public_form')
    expect(payload.first_name).toBe('Jamie')
    expect(payload.consent_given).toBe(true)
    expect(payload.preferred_foot).toBe('right')
  })

  it('rejects an application that fails validation', async () => {
    const res = await POST(makeRequest(validApplication({ consent_given: false })))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/consent is required/i)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects a malformed (non-JSON) body', async () => {
    const req = new NextRequest('http://localhost/api/recruitment/apply', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns a fake success for honeypot submissions without inserting anything', async () => {
    const res = await POST(makeRequest(validApplication({ website: 'https://spam.example' })))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('normalises an invalid preferred_foot to null instead of failing the DB check', async () => {
    await POST(makeRequest(validApplication({ preferred_foot: 'head' })))
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(insertMock.mock.calls[0][0].preferred_foot).toBeNull()
  })

  it('returns a generic 500 when the insert fails, without leaking details', async () => {
    insertMock.mockResolvedValue({ error: { message: 'duplicate key value violates constraint' } })
    const res = await POST(makeRequest(validApplication()))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).not.toMatch(/duplicate key/i)
  })
})
