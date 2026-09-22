/**
 * @jest-environment node
 *
 * Covers two things for this route:
 *
 * 1. The "name field swallows the message" bug class fixed app-wide
 *    2026-09-14 — a schedule slot's label had no length cap either.
 * 2. The silent-wipe bug (2026-09-22): the route used to delete every slot and
 *    then insert the new ones, neither checked, and return success regardless.
 *    The replacement now goes through the replace_schedule_slots RPC
 *    (migration 083) so it is one transaction, and a failure is reported.
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()

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

type AdminOverrides = {
  rpcResult?: { error: { message: string } | null }
  templateResult?: { data: { id: string } | null; error: { message: string } | null }
}

function setupAdmin(overrides: AdminOverrides = {}) {
  const { rpcResult = { error: null }, templateResult = { data: { id: 'tmpl-1' }, error: null } } = overrides

  const templateSingle = jest.fn(async () => templateResult)
  const templateSelect = jest.fn(() => ({ single: templateSingle }))
  const templateInsert = jest.fn(() => ({ select: templateSelect }))

  const usersEq2 = jest.fn(async () => ({ data: [] }))
  const usersEq1 = jest.fn(() => ({ eq: usersEq2 }))
  const usersSelect = jest.fn(() => ({ eq: usersEq1 }))

  // schedule_slots is deliberately absent: the route must not touch the table
  // directly any more, and reaching for it here throws.
  const from = jest.fn((table: string) => {
    if (table === 'schedule_templates') return { insert: templateInsert }
    if (table === 'users') return { select: usersSelect }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  const rpc = jest.fn(async () => rpcResult)

  return { from, rpc, templateInsert }
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
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it('saves the schedule when every label is 60 characters or fewer', async () => {
    const admin = setupAdmin()
    authorizeAsStaff(admin)

    const res = await POST(makeRequest({ templateId: 'tmpl-1', slots: validSlots('A'.repeat(60)) }))

    expect(res.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledTimes(1)
  })

  it('replaces the slots through the atomic RPC rather than delete-then-insert', async () => {
    const admin = setupAdmin()
    authorizeAsStaff(admin)

    await POST(makeRequest({ templateId: 'tmpl-1', slots: validSlots() }))

    expect(admin.rpc).toHaveBeenCalledWith('replace_schedule_slots', {
      p_template_id: 'tmpl-1',
      p_slots: [{
        day_of_week: 1,
        slot_order: 1,
        start_time: '09:00',
        end_time: '10:00',
        session_type: 'lesson',
        session_label: 'Maths GCSE',
      }],
    })
  })

  it('still calls the RPC with an empty list so clearing the whole week works', async () => {
    const admin = setupAdmin()
    authorizeAsStaff(admin)

    const res = await POST(makeRequest({ templateId: 'tmpl-1', slots: {} }))

    expect(res.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('replace_schedule_slots', {
      p_template_id: 'tmpl-1',
      p_slots: [],
    })
  })

  it('reports a failed replacement instead of returning success', async () => {
    const admin = setupAdmin({ rpcResult: { error: { message: 'violates check constraint' } } })
    authorizeAsStaff(admin)

    const res = await POST(makeRequest({ templateId: 'tmpl-1', slots: validSlots() }))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toContain('violates check constraint')
    expect(body.templateId).toBeUndefined()
  })

  it('reports a failed template creation instead of returning success', async () => {
    const admin = setupAdmin({ templateResult: { data: null, error: { message: 'permission denied' } } })
    authorizeAsStaff(admin)

    const res = await POST(makeRequest({ templateId: null, slots: validSlots() }))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toContain('permission denied')
    expect(admin.rpc).not.toHaveBeenCalled()
  })
})
