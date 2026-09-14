/**
 * @jest-environment node
 *
 * Regression coverage for the same "name field swallows the message" bug
 * class fixed app-wide 2026-09-14 — a trial event's title had no length
 * cap either, on either the client form or this route.
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
  createAdminClient: () => ({ from: adminFromMock }),
}))

import { POST } from '@/app/api/recruitment/trials/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/recruitment/trials', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(title = 'U15 open trial') {
  return { title, event_date: '2026-10-01' }
}

function setupAdmin() {
  const roleMaybeSingle = jest.fn(async () => ({ data: { role: 'coach' } }))
  const roleEq = jest.fn(() => ({ maybeSingle: roleMaybeSingle }))
  const roleSelect = jest.fn(() => ({ eq: roleEq }))

  const insertSingle = jest.fn(async () => ({ data: { id: 'trial-1' }, error: null }))
  const insertSelect = jest.fn(() => ({ single: insertSingle }))
  const insert = jest.fn(() => ({ select: insertSelect }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'users') return { select: roleSelect }
    if (table === 'trial_events') return { insert }
    throw new Error(`Unexpected table in test: ${table}`)
  })
  return { insert }
}

beforeEach(() => {
  getUserMock.mockReset()
  adminFromMock.mockReset()
})

describe('POST /api/recruitment/trials', () => {
  it('rejects a title over 60 characters and never creates the trial', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'staff-1' } } })
    const { insert } = setupAdmin()

    const res = await POST(makeRequest(validBody('A'.repeat(61))))

    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('creates the trial when the title is 60 characters or fewer', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'staff-1' } } })
    const { insert } = setupAdmin()

    const res = await POST(makeRequest(validBody('A'.repeat(60))))

    expect(res.status).toBe(201)
    expect(insert).toHaveBeenCalledTimes(1)
  })
})
