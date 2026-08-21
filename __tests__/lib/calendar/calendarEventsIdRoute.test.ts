/**
 * @jest-environment node
 *
 * Unit tests for the calendar-events [eventId] PATCH handler.
 * Runs in the node environment so the Web Request/Response globals used by
 * NextRequest are available (jsdom does not provide them).
 * requireStaff is mocked so the handler's own logic (validation, update
 * payload) can be tested in isolation without a live database.
 *
 * Regression coverage for: rescheduling an event via PATCH must reset
 * reminder_sent_at to null, otherwise the reminder cron's
 * `.is('reminder_sent_at', null)` filter permanently excludes the event
 * after the first reminder has fired.
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { PATCH } from '@/app/api/admin/calendar-events/[eventId]/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/calendar-events/e1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    title: 'Parents evening',
    event_date: '2026-09-02',
    event_time: '18:30',
    description: 'Bring your reports',
  }
}

/** Builds the admin .from() router used by the handler. */
function setupAdmin() {
  const eqMock = jest.fn(async () => ({ error: null }))
  const updateMock = jest.fn(() => ({ eq: eqMock }))
  adminFromMock.mockImplementation((table: string) => {
    if (table === 'calendar_events') {
      return { update: updateMock }
    }
    throw new Error(`Unexpected table ${table}`)
  })
  return { updateMock, eqMock }
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

describe('PATCH /api/admin/calendar-events/[eventId]', () => {
  it('resets reminder_sent_at to null on every update', async () => {
    authorizeAsStaff()
    const { updateMock, eqMock } = setupAdmin()

    const res = await PATCH(makeRequest(validBody()), { params: { eventId: 'e1' } })

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledTimes(1)
    const payload = updateMock.mock.calls[0][0] as { reminder_sent_at: unknown }
    expect(payload.reminder_sent_at).toBeNull()
    expect(eqMock).toHaveBeenCalledWith('id', 'e1')
  })

  it('returns 400 when event_date is missing', async () => {
    authorizeAsStaff()
    setupAdmin()

    const { event_date, ...bodyWithoutDate } = validBody()
    const res = await PATCH(makeRequest(bodyWithoutDate), { params: { eventId: 'e1' } })

    expect(res.status).toBe(400)
  })

  it('returns 400 when event_date is malformed', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await PATCH(
      makeRequest({ ...validBody(), event_date: '02/09/2026' }),
      { params: { eventId: 'e1' } }
    )

    expect(res.status).toBe(400)
  })
})
