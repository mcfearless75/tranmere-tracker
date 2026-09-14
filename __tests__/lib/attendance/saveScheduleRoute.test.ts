/**
 * @jest-environment node
 *
 * Regression coverage for the same "name field swallows the message" bug
 * class fixed app-wide 2026-09-14 — a schedule slot's label had no length
 * cap either.
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

jest.mock('@/lib/webpush', () => ({ sendPushNotification: jest.fn() }))

import { POST } from '@/app/api/attendance/save-schedule/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/attendance/save-schedule', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validSlots(label = 'Maths GCSE') {
  return {
    1: [{ type: 'lesson', label, startTime: '09:00', endTime: '10:00' }],
  }
}

function setupAdmin() {
  const templateSingle = jest.fn(async () => ({ data: { id: 'tmpl-1' } }))
  const templateSelect = jest.fn(() => ({ single: templateSingle }))
  const templateInsert = jest.fn(() => ({ select: templateSelect }))

  const slotsDeleteEq = jest.fn(async () => ({ error: null }))
  const slotsDelete = jest.fn(() => ({ eq: slotsDeleteEq }))
  const slotsInsert = jest.fn(async () => ({ error: null }))

  const usersEq2 = jest.fn(async () => ({ data: [] }))
  const usersEq1 = jest.fn(() => ({ eq: usersEq2 }))
  const usersSelect = jest.fn(() => ({ eq: usersEq1 }))

  const from = jest.fn((table: string) => {
    if (table === 'schedule_templates') return { insert: templateInsert }
    if (table === 'schedule_slots') return { delete: slotsDelete, insert: slotsInsert }
    if (table === 'users') return { select: usersSelect }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from, slotsInsert }
}

function authorizeAsStaff(admin: ReturnType<typeof setupAdmin>) {
  requireStaffMock.mockResolvedValue({
    ok: true,
    ctx: { user: { id: 'u1' }, role: 'admin', admin },
  })
}

beforeEach(() => {
  requireStaffMock.mockReset()
})

describe('POST /api/attendance/save-schedule', () => {
  it('rejects a session label over 60 characters and never saves the schedule', async () => {
    const admin = setupAdmin()
    authorizeAsStaff(admin)

    const res = await POST(makeRequest({ templateId: 'tmpl-1', slots: validSlots('A'.repeat(61)) }))

    expect(res.status).toBe(400)
    expect(admin.slotsInsert).not.toHaveBeenCalled()
  })

  it('saves the schedule when every label is 60 characters or fewer', async () => {
    const admin = setupAdmin()
    authorizeAsStaff(admin)

    const res = await POST(makeRequest({ templateId: 'tmpl-1', slots: validSlots('A'.repeat(60)) }))

    expect(res.status).toBe(200)
    expect(admin.slotsInsert).toHaveBeenCalledTimes(1)
  })
})
