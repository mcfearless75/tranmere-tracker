/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { PATCH, DELETE } from '@/app/api/admin/timetable-slots/[slotId]/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/timetable-slots/s1', {
    method: 'PATCH',
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
  }
}

function setupAdmin() {
  const eqMock = jest.fn(async () => ({ error: null }))
  const updateMock = jest.fn(() => ({ eq: eqMock }))
  const deleteMock = jest.fn(() => ({ eq: eqMock }))
  adminFromMock.mockImplementation((table: string) => {
    if (table === 'timetable_slots') return { update: updateMock, delete: deleteMock }
    throw new Error(`Unexpected table ${table}`)
  })
  return { updateMock, deleteMock, eqMock }
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

describe('PATCH /api/admin/timetable-slots/[slotId]', () => {
  it('updates the slot', async () => {
    authorizeAsStaff()
    const { updateMock, eqMock } = setupAdmin()

    const res = await PATCH(makeRequest(validBody()), { params: { slotId: 's1' } })

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(eqMock).toHaveBeenCalledWith('id', 's1')
  })

  it('returns 400 when day_of_week is Wednesday', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await PATCH(makeRequest({ ...validBody(), day_of_week: 3 }), { params: { slotId: 's1' } })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/admin/timetable-slots/[slotId]', () => {
  it('deletes the slot', async () => {
    authorizeAsStaff()
    const { deleteMock, eqMock } = setupAdmin()

    const res = await DELETE(makeRequest(undefined), { params: { slotId: 's1' } })

    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(eqMock).toHaveBeenCalledWith('id', 's1')
  })
})
