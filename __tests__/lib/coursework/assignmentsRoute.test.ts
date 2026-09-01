/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { POST } from '@/app/api/admin/assignments/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/assignments', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    unit_id: 'unit-1',
    title: 'Coaching Portfolio',
    description: 'Write up your coaching sessions',
    due_date: '2026-10-15',
    grade_target: 'merit',
  }
}

function setupAdmin(options: { unitExists?: boolean } = {}) {
  const { unitExists = true } = options
  const unitMaybeSingleMock = jest.fn(async () => ({
    data: unitExists ? { id: 'unit-1' } : null,
    error: null,
  }))
  const unitEqMock = jest.fn(() => ({ maybeSingle: unitMaybeSingleMock }))
  const unitSelectMock = jest.fn(() => ({ eq: unitEqMock }))

  const insertSingleMock = jest.fn(async () => ({
    data: { id: 'a1', ...validBody(), created_at: '2026-09-01T00:00:00Z' },
    error: null,
  }))
  const insertSelectMock = jest.fn(() => ({ single: insertSingleMock }))
  const insertMock = jest.fn(() => ({ select: insertSelectMock }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'btec_units') return { select: unitSelectMock }
    if (table === 'assignments') return { insert: insertMock }
    throw new Error(`Unexpected table ${table}`)
  })
  return { insertMock }
}

function authorizeAsStaff() {
  requireStaffMock.mockResolvedValue({
    ok: true,
    ctx: { user: { id: 'u1' }, role: 'admin', admin: { from: adminFromMock } },
  })
}

beforeEach(() => {
  requireStaffMock.mockReset()
  adminFromMock.mockReset()
})

describe('POST /api/admin/assignments', () => {
  it('creates an assignment when the unit exists', async () => {
    authorizeAsStaff()
    const { insertMock } = setupAdmin()

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(200)
    expect(insertMock).toHaveBeenCalledTimes(1)
    const payload = insertMock.mock.calls[0][0] as { unit_id: string; title: string }
    expect(payload.unit_id).toBe('unit-1')
    expect(payload.title).toBe('Coaching Portfolio')
  })

  it('returns 400 when title is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { title, ...bodyWithoutTitle } = validBody()

    const res = await POST(makeRequest(bodyWithoutTitle))

    expect(res.status).toBe(400)
  })

  it('returns 400 when due_date is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { due_date, ...bodyWithoutDueDate } = validBody()

    const res = await POST(makeRequest(bodyWithoutDueDate))

    expect(res.status).toBe(400)
  })

  it('returns 400 when unit_id is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { unit_id, ...bodyWithoutUnitId } = validBody()

    const res = await POST(makeRequest(bodyWithoutUnitId))

    expect(res.status).toBe(400)
  })

  it('returns 400 when unit_id does not reference a real unit', async () => {
    authorizeAsStaff()
    setupAdmin({ unitExists: false })

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(400)
  })

  it('returns the auth response when the caller is not staff', async () => {
    const { NextResponse } = await import('next/server')
    requireStaffMock.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(403)
  })
})
