/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { PATCH, DELETE } from '@/app/api/admin/assignments/[assignmentId]/route'

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/assignments/a1', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    title: 'Coaching Portfolio (revised)',
    description: 'Updated brief',
    due_date: '2026-10-20',
    grade_target: 'distinction',
  }
}

function setupAdmin() {
  const updateEqMock = jest.fn(async () => ({ error: null }))
  const updateMock = jest.fn(() => ({ eq: updateEqMock }))
  const deleteEqMock = jest.fn(async () => ({ error: null }))
  const deleteMock = jest.fn(() => ({ eq: deleteEqMock }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'assignments') return { update: updateMock, delete: deleteMock }
    throw new Error(`Unexpected table ${table}`)
  })
  return { updateMock, updateEqMock, deleteMock, deleteEqMock }
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

describe('PATCH /api/admin/assignments/[assignmentId]', () => {
  it('updates an assignment', async () => {
    authorizeAsStaff()
    const { updateMock, updateEqMock } = setupAdmin()

    const res = await PATCH(makeRequest('PATCH', validBody()), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateEqMock).toHaveBeenCalledWith('id', 'a1')
  })

  it('returns 400 when title is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { title, ...bodyWithoutTitle } = validBody()

    const res = await PATCH(makeRequest('PATCH', bodyWithoutTitle), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(400)
  })

  it('returns the auth response when the caller is not staff', async () => {
    const { NextResponse } = await import('next/server')
    requireStaffMock.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })

    const res = await PATCH(makeRequest('PATCH', validBody()), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/assignments/[assignmentId]', () => {
  it('deletes an assignment', async () => {
    authorizeAsStaff()
    const { deleteMock, deleteEqMock } = setupAdmin()

    const res = await DELETE(makeRequest('DELETE'), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'a1')
  })

  it('returns the auth response when the caller is not staff', async () => {
    const { NextResponse } = await import('next/server')
    requireStaffMock.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })

    const res = await DELETE(makeRequest('DELETE'), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(403)
  })
})
