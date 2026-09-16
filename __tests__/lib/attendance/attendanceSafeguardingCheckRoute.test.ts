/**
 * @jest-environment node
 *
 * Regression coverage for the atomic-raise fix: a plain select-then-insert
 * into safeguarding_concerns was generating ~490 duplicate-key Postgres
 * errors/day (confirmed via the Supabase log explorer, 2026-09-15) — the
 * same already-cased student retried, and failed, on every 15-min tick for
 * the rest of the day. raise_attendance_safeguarding_concern() (migration
 * 070) now does the check-and-insert atomically server-side; the route
 * calls it via admin.rpc() and treats zero rows back as "already raised,
 * no-op" rather than an error. Same idempotent-upsert treatment for the
 * stage-1 nudge log.
 */
const adminFromMock = jest.fn()
const adminRpcMock = jest.fn()
const sendPushNotificationMock = jest.fn(() => Promise.resolve())

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
  rpcRowsByStudent?: Record<string, { id: string }[]>
} = {}) {
  const {
    students = [{ id: 'student-1', name: 'Alice' }],
    atRiskRows = [{ student_id: 'student-1', am_checked_at: '2026-09-10T08:00:00Z', lunch_checked_at: null, pm_checked_at: null }],
    nudgeAlreadySent = false,
    nudgeUpsertRows = [{ attendance_date: '2026-09-10' }],
    rpcRowsByStudent = { 'student-1': [{ id: 'concern-1' }] },
  } = opts

  const nudgeUpsertSelectMock = jest.fn(() => Promise.resolve({ data: nudgeUpsertRows, error: null }))
  const nudgeUpsertMock = jest.fn(() => ({ select: nudgeUpsertSelectMock }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'academy_settings') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { pm_window_start: '12:00:00' } }) }) }) }
    }
    if (table === 'users') {
      return {
        // Three distinct call shapes off this table: students
        // (.eq('role','student').eq('is_active', true)), staff-group
        // (.in('role', [...])), and the stage-2 admin-only DSL query
        // (.eq('role', 'admin') alone, no second .eq()).
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

  adminRpcMock.mockImplementation((fn: string, args: { p_student_id: string }) => {
    if (fn === 'raise_attendance_safeguarding_concern') {
      return Promise.resolve({ data: rpcRowsByStudent[args.p_student_id] ?? [], error: null })
    }
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
  it('raises a case via the atomic RPC and notifies admins when past the case deadline', async () => {
    jest.setSystemTime(new Date('2026-09-10T13:31:00Z')) // 14:31 London BST — past the 13:30 case deadline
    setupAdmin()
    const res = await GET(makeRequest())
    const json = await res.json()

    expect(adminRpcMock).toHaveBeenCalledWith('raise_attendance_safeguarding_concern', expect.objectContaining({
      p_student_id: 'student-1',
      p_raised_date: '2026-09-10',
    }))
    expect(json.raised).toBe(1)
  })

  it('treats zero rows back from the RPC as already-raised — no error, no duplicate notification', async () => {
    jest.setSystemTime(new Date('2026-09-10T13:31:00Z'))
    setupAdmin({ rpcRowsByStudent: { 'student-1': [] } })
    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json.raised).toBe(0)
    // Only the stage-1 nudge push, no stage-2 "case opened" push.
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
  })

  it('sends the stage-1 nudge only once — upsert returning zero rows means it already sent', async () => {
    jest.setSystemTime(new Date('2026-09-10T12:00:00Z')) // 13:00 London BST — past nudge deadline (12:30), before case deadline (13:30)
    const { nudgeUpsertMock } = setupAdmin({ nudgeUpsertRows: [] })
    const res = await GET(makeRequest())
    const json = await res.json()

    expect(nudgeUpsertMock).toHaveBeenCalledWith(
      { attendance_date: '2026-09-10', notified_count: 1 },
      { onConflict: 'attendance_date', ignoreDuplicates: true },
    )
    expect(json.nudged).toBeUndefined()
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('skips entirely before the nudge grace period is reached', async () => {
    jest.setSystemTime(new Date('2026-09-10T11:00:00Z')) // 12:00 London BST — pm_window_start itself, before the 12:30 nudge deadline
    setupAdmin()
    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json).toEqual({ skipped: true, reason: 'grace period not reached yet' })
    expect(adminRpcMock).not.toHaveBeenCalled()
  })
})
