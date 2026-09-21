/**
 * @jest-environment node
 *
 * This cron used to do two things: nudge staff at PM + 30, then auto-raise a
 * safeguarding case later in the afternoon. The second stage was deliberately
 * removed (5438d35, with migration 076 closing the cases it had already
 * opened, and 4e84cc1 taking them off the safeguarding board) — a forgotten
 * tap is not a safeguarding concern, and missing students now surface on Home
 * and the register instead.
 *
 * So the coverage here is: the stage-1 nudge still fires exactly once a day
 * (the idempotent upsert that killed ~490 duplicate-key errors/day, confirmed
 * via the Supabase log explorer 2026-09-15), and no case is ever raised —
 * including past the hour the old stage-2 deadline used to sit at.
 */
const adminFromMock = jest.fn()
const adminRpcMock = jest.fn()
const sendPushNotificationMock = jest.fn((..._args: unknown[]) => Promise.resolve())

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock, rpc: adminRpcMock }),
}))
jest.mock('@/lib/security', () => ({
  verifyCronSecret: () => true,
}))
jest.mock('@/lib/webpush', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...args),
}))

import { GET } from '@/app/api/cron/attendance-safeguarding-check/route'

function makeRequest(): Request {
  return new Request('http://localhost/api/cron/attendance-safeguarding-check')
}

function setupAdmin(opts: {
  atRiskRows?: { student_id: string; am_checked_at: string | null; lunch_checked_at: string | null; pm_checked_at: string | null }[]
  students?: { id: string; name: string }[]
  nudgeAlreadySent?: boolean
  nudgeUpsertRows?: { attendance_date: string }[]
} = {}) {
  const {
    students = [{ id: 'student-1', name: 'Alice' }],
    atRiskRows = [{ student_id: 'student-1', am_checked_at: '2026-09-10T08:00:00Z', lunch_checked_at: null, pm_checked_at: null }],
    nudgeAlreadySent = false,
    nudgeUpsertRows = [{ attendance_date: '2026-09-10' }],
  } = opts

  const nudgeUpsertSelectMock = jest.fn(() => Promise.resolve({ data: nudgeUpsertRows, error: null }))
  const nudgeUpsertMock = jest.fn(() => ({ select: nudgeUpsertSelectMock }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'academy_settings') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { pm_window_start: '12:00:00' } }) }) }) }
    }
    if (table === 'users') {
      return {
        // Two call shapes off this table: students
        // (.eq('role','student').eq('is_active', true)) and the staff group
        // that receives the nudge (.in('role', [...])).
        select: () => ({
          eq: (_col: string, val: unknown) =>
            val === 'student'
              ? { eq: () => Promise.resolve({ data: students, error: null }) }
              : Promise.resolve({ data: [{ id: 'admin-1' }], error: null }),
          in: () => Promise.resolve({ data: [{ id: 'staff-1' }], error: null }),
        }),
      }
    }
    if (table === 'daily_attendance') {
      return { select: () => ({ eq: () => Promise.resolve({ data: atRiskRows, error: null }) }) }
    }
    if (table === 'attendance_excusals') {
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
    }
    if (table === 'attendance_safeguarding_nudge_log') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: nudgeAlreadySent ? { attendance_date: '2026-09-10' } : null }) }),
        }),
        upsert: nudgeUpsertMock,
      }
    }
    if (table === 'push_subscriptions') {
      return { select: () => ({ in: () => Promise.resolve({ data: [{ endpoint: 'e', p256dh: 'p', auth: 'a' }] }) }) }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  // The route should not call rpc() at all any more; make it loud if it does.
  adminRpcMock.mockImplementation((fn: string) => {
    throw new Error(`Unexpected rpc: ${fn}`)
  })

  return { nudgeUpsertMock }
}

beforeEach(() => {
  adminFromMock.mockReset()
  adminRpcMock.mockReset()
  sendPushNotificationMock.mockClear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('GET /api/cron/attendance-safeguarding-check', () => {
  it('nudges staff about the students who are quiet since lunch', async () => {
    jest.setSystemTime(new Date('2026-09-10T12:00:00Z')) // 13:00 London BST — past PM + 30
    setupAdmin()
    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json).toEqual({ checked: 1, nudged: 1, cases: 0 })
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
  })

  it('never auto-raises a safeguarding case, even at the hour stage 2 used to fire', async () => {
    jest.setSystemTime(new Date('2026-09-10T13:31:00Z')) // 14:31 London BST — past the old 13:30 case deadline
    setupAdmin()
    const res = await GET(makeRequest())
    const json = await res.json()

    expect(adminRpcMock).not.toHaveBeenCalled()
    expect(json.cases).toBe(0)
    expect(json.raised).toBeUndefined()
    // The staff nudge, and nothing resembling a "case opened" push.
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
  })

  it('sends the stage-1 nudge only once — upsert returning zero rows means it already sent', async () => {
    jest.setSystemTime(new Date('2026-09-10T12:00:00Z'))
    const { nudgeUpsertMock } = setupAdmin({ nudgeUpsertRows: [] })
    const res = await GET(makeRequest())
    const json = await res.json()

    expect(nudgeUpsertMock).toHaveBeenCalledWith(
      { attendance_date: '2026-09-10', notified_count: 1 },
      { onConflict: 'attendance_date', ignoreDuplicates: true },
    )
    expect(json.nudged).toBe(0)
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it("does not re-notify when today's nudge is already logged", async () => {
    jest.setSystemTime(new Date('2026-09-10T12:00:00Z'))
    setupAdmin({ nudgeAlreadySent: true })
    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json).toEqual({ checked: 1, nudged: 0 })
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('skips entirely before the nudge grace period is reached', async () => {
    jest.setSystemTime(new Date('2026-09-10T11:00:00Z')) // 12:00 London BST — pm_window_start itself
    setupAdmin()
    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json).toEqual({ skipped: true, reason: 'grace period not reached yet' })
    expect(adminRpcMock).not.toHaveBeenCalled()
  })
})
