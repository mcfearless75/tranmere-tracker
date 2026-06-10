/**
 * @jest-environment node
 *
 * Unit tests for the bursaries create API handler.
 * Runs in the node environment so the Web Request/Response globals used by
 * NextRequest are available (jsdom does not provide them).
 * The Supabase server and admin clients are mocked so the handler logic
 * (strict admin-only gate, validation, atomic bursary + payments insert,
 * rollback on payment failure) can be tested without a live database.
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

import { POST } from '@/app/api/bursaries/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/bursaries', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validBody = {
  student_id: 'student-1',
  award_label: 'Travel bursary',
  amount_per_period: 25,
  period: 'weekly',
  start_date: '2026-01-01',
  end_date: '2026-01-15',
}

/** Builds the admin .from() router used by the handler. */
function setupAdmin(opts: {
  role?: string | null
  bursaryInsertError?: { message: string } | null
  paymentsInsertError?: { message: string } | null
}) {
  const { role = 'admin', bursaryInsertError = null, paymentsInsertError = null } = opts

  const paymentsInsertMock = jest.fn(
    async (_rows: Array<Record<string, unknown>>) => ({ error: paymentsInsertError }),
  )
  const bursaryDeleteEqMock = jest.fn(
    async (_column: string, _value: string) => ({ error: null }),
  )

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
    if (table === 'bursaries') {
      return {
        insert: () => ({
          select: () => ({
            single: async () =>
              bursaryInsertError
                ? { data: null, error: bursaryInsertError }
                : { data: { id: 'bursary-1', award_label: 'Travel bursary' }, error: null },
          }),
        }),
        delete: () => ({ eq: bursaryDeleteEqMock }),
      }
    }
    if (table === 'bursary_payments') {
      return { insert: paymentsInsertMock }
    }
    throw new Error(`Unexpected table ${table}`)
  })

  return { paymentsInsertMock, bursaryDeleteEqMock }
}

beforeEach(() => {
  getUserMock.mockReset()
  adminFromMock.mockReset()
})

describe('POST /api/bursaries', () => {
  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    setupAdmin({})
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 401 when the user is a coach (staff is not enough)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ role: 'coach' })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 401 when the user is a teacher', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({ role: 'teacher' })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 400 for a non-positive amount', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({})
    const res = await POST(makeRequest({ ...validBody, amount_per_period: 0 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid period', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({})
    const res = await POST(makeRequest({ ...validBody, period: 'fortnightly' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when end_date is before start_date', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    setupAdmin({})
    const res = await POST(makeRequest({ ...validBody, end_date: '2025-12-01' }))
    expect(res.status).toBe(400)
  })

  it('creates the bursary and its generated payments for a valid admin request', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    const { paymentsInsertMock } = setupAdmin({})

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json.bursary.id).toBe('bursary-1')
    // 1, 8 and 15 January = three weekly payments
    expect(json.paymentCount).toBe(3)

    expect(paymentsInsertMock).toHaveBeenCalledTimes(1)
    const insertedRows = paymentsInsertMock.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(insertedRows).toHaveLength(3)
    expect(insertedRows[0]).toEqual({
      bursary_id: 'bursary-1',
      due_date: '2026-01-01',
      amount: 25,
      status: 'pending',
    })
  })

  it('rolls back the bursary and returns 500 when the payments insert fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    const { bursaryDeleteEqMock } = setupAdmin({
      paymentsInsertError: { message: 'db down' },
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(500)
    expect(bursaryDeleteEqMock).toHaveBeenCalledWith('id', 'bursary-1')
  })

  it('returns 500 when the bursary insert itself fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    const { paymentsInsertMock } = setupAdmin({
      bursaryInsertError: { message: 'db down' },
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(500)
    expect(paymentsInsertMock).not.toHaveBeenCalled()
  })
})
