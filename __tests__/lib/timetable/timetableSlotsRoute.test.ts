/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { POST } from '@/app/api/admin/timetable-slots/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/timetable-slots', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    title: 'Football 1',
    day_of_week: 1,
    start_time: '11:00',
    end_time: '12:30',
    location: 'Tranmere Pitch 1',
    tutor: 'Chaid White',
    year_group: 1,
  }
}

function setupAdmin() {
  const singleMock = jest.fn(async () => ({
    data: { id: 's1', ...validBody(), year_group: 1, created_at: '2026-09-01T00:00:00Z' },
    error: null,
  }))
  const selectMock = jest.fn(() => ({ single: singleMock }))
  const insertMock = jest.fn(() => ({ select: selectMock }))
  adminFromMock.mockImplementation((table: string) => {
    if (table === 'timetable_slots') return { insert: insertMock }
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

describe('POST /api/admin/timetable-slots', () => {
  it('creates a slot with the requested year_group', async () => {
    authorizeAsStaff()
    const { insertMock } = setupAdmin()

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(200)
    expect(insertMock).toHaveBeenCalledTimes(1)
    const payload = insertMock.mock.calls[0][0] as { year_group: number; created_by: string }
    expect(payload.year_group).toBe(1)
    expect(payload.created_by).toBe('u1')
  })

  it('creates a 2nd-year slot when year_group is 2', async () => {
    authorizeAsStaff()
    const { insertMock } = setupAdmin()

    const res = await POST(makeRequest({ ...validBody(), year_group: 2 }))

    expect(res.status).toBe(200)
    const payload = insertMock.mock.calls[0][0] as { year_group: number }
    expect(payload.year_group).toBe(2)
  })

  it('returns 400 when year_group is not 1 or 2', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await POST(makeRequest({ ...validBody(), year_group: 3 }))

    expect(res.status).toBe(400)
  })

  it('returns 400 when year_group is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { year_group, ...bodyWithoutYearGroup } = validBody()

    const res = await POST(makeRequest(bodyWithoutYearGroup))

    expect(res.status).toBe(400)
  })

  it('returns 400 when title is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { title, ...bodyWithoutTitle } = validBody()

    const res = await POST(makeRequest(bodyWithoutTitle))

    expect(res.status).toBe(400)
  })

  it('returns 400 when day_of_week is Wednesday', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await POST(makeRequest({ ...validBody(), day_of_week: 3 }))

    expect(res.status).toBe(400)
  })

  it('returns 400 when end_time is not after start_time', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await POST(makeRequest({ ...validBody(), start_time: '12:00', end_time: '11:00' }))

    expect(res.status).toBe(400)
  })

  it('returns the auth response when the caller is not staff', async () => {
    const { NextResponse } = await import('next/server')
    requireStaffMock.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(403)
  })
})
