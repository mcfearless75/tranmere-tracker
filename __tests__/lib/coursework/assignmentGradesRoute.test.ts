/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { POST } from '@/app/api/admin/assignments/[assignmentId]/grades/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/assignments/a1/grades', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    grades: [
      { student_id: 's1', grade: 'merit' },
      { student_id: 's2', grade: null },
    ],
  }
}

function setupAdmin(options: { eligibleIds?: string[] } = {}) {
  const { eligibleIds = ['s1', 's2'] } = options

  const assignmentMaybeSingleMock = jest.fn(async () => ({ data: { id: 'a1', unit_id: 'unit-1' }, error: null }))
  const assignmentEqMock = jest.fn(() => ({ maybeSingle: assignmentMaybeSingleMock }))
  const assignmentSelectMock = jest.fn(() => ({ eq: assignmentEqMock }))

  const unitMaybeSingleMock = jest.fn(async () => ({ data: { id: 'unit-1', course_id: 'c1' }, error: null }))
  const unitEqMock = jest.fn(() => ({ maybeSingle: unitMaybeSingleMock }))
  const unitSelectMock = jest.fn(() => ({ eq: unitEqMock }))

  const usersSecondEqMock = jest.fn(async () => ({
    data: eligibleIds.map(id => ({ id })),
    error: null,
  }))
  const usersFirstEqMock = jest.fn(() => ({ eq: usersSecondEqMock }))
  const usersSelectMock = jest.fn(() => ({ eq: usersFirstEqMock }))

  const upsertMock = jest.fn(async () => ({ error: null }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'assignments') return { select: assignmentSelectMock }
    if (table === 'btec_units') return { select: unitSelectMock }
    if (table === 'users') return { select: usersSelectMock }
    if (table === 'assignment_grades') return { upsert: upsertMock }
    throw new Error(`Unexpected table ${table}`)
  })

  return { upsertMock }
}

function authorizeAsStaff() {
  requireStaffMock.mockResolvedValue({
    ok: true,
    ctx: { user: { id: 'staff-1' }, role: 'admin', admin: { from: adminFromMock } },
  })
}

beforeEach(() => {
  requireStaffMock.mockReset()
  adminFromMock.mockReset()
})

describe('POST /api/admin/assignments/[assignmentId]/grades', () => {
  it('upserts a grade row per student', async () => {
    authorizeAsStaff()
    const { upsertMock } = setupAdmin()

    const res = await POST(makeRequest(validBody()), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalledTimes(1)
    const [rows, options] = upsertMock.mock.calls[0] as [
      Array<{ assignment_id: string; student_id: string; grade: string | null }>,
      { onConflict: string }
    ]
    expect(options).toEqual({ onConflict: 'assignment_id,student_id' })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ assignment_id: 'a1', student_id: 's1', grade: 'merit' })
    expect(rows[1]).toMatchObject({ assignment_id: 'a1', student_id: 's2', grade: null })
  })

  it('returns 400 when grades is missing or empty', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await POST(makeRequest({ grades: [] }), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(400)
  })

  it('returns 400 when a grade value is invalid', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await POST(
      makeRequest({ grades: [{ student_id: 's1', grade: 'A-star' }] }),
      { params: { assignmentId: 'a1' } }
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 when a student is not enrolled on the course', async () => {
    authorizeAsStaff()
    setupAdmin({ eligibleIds: ['s1'] }) // s2 not eligible

    const res = await POST(makeRequest(validBody()), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(400)
  })

  it('returns 404 when the assignment does not exist', async () => {
    authorizeAsStaff()
    const assignmentMaybeSingleMock = jest.fn(async () => ({ data: null, error: null }))
    const assignmentEqMock = jest.fn(() => ({ maybeSingle: assignmentMaybeSingleMock }))
    const assignmentSelectMock = jest.fn(() => ({ eq: assignmentEqMock }))
    adminFromMock.mockImplementation((table: string) => {
      if (table === 'assignments') return { select: assignmentSelectMock }
      throw new Error(`Unexpected table ${table}`)
    })

    const res = await POST(makeRequest(validBody()), { params: { assignmentId: 'missing' } })

    expect(res.status).toBe(404)
  })

  it('returns the auth response when the caller is not staff', async () => {
    const { NextResponse } = await import('next/server')
    requireStaffMock.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })

    const res = await POST(makeRequest(validBody()), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(403)
  })
})
