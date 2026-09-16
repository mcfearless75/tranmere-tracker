/**
 * @jest-environment node
 *
 * Regression coverage for 2026-09-14: dropped 'lunch' from this sweep's
 * phases. A student who simply never leaves the building for lunch isn't a
 * safety signal on its own, but this cron couldn't distinguish that from
 * someone genuinely missing — it fired the same staff alert either way,
 * every day, for every student who stayed in. attendance-safeguarding-check
 * already covers the real risk (missing BOTH lunch and PM after an AM
 * check-in), so this sweep now only ever nudges for AM.
 */
const adminFromMock = jest.fn()
const sendPushNotificationMock = jest.fn((..._args: unknown[]) => Promise.resolve())

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))
jest.mock('@/lib/security', () => ({
  verifyCronSecret: () => true,
}))
jest.mock('@/lib/webpush', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...args),
}))

import { GET } from '@/app/api/cron/missed-checkin-sweep/route'

function setupAdmin(opts: {
  students?: { id: string; name: string }[]
  dailyRows?: { student_id: string; am_checked_at: string | null }[]
  excusals?: { student_id: string; phases: string[] }[]
  alreadySwept?: boolean
} = {}) {
  const {
    students = [{ id: 'student-1', name: 'Alice' }, { id: 'student-2', name: 'Bob' }],
    dailyRows = [],
    excusals = [],
    alreadySwept = false,
  } = opts

  const academySelectMock = jest.fn(() => ({
    eq: () => ({ maybeSingle: () => Promise.resolve({ data: { am_window_end: '09:00:00' } }) }),
  }))
  const sweepLogInsertMock = jest.fn(() => Promise.resolve({ error: null }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'academy_settings') return { select: academySelectMock }
    if (table === 'attendance_sweep_log') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: alreadySwept ? { id: 'sweep-1' } : null }) }),
          }),
        }),
        insert: sweepLogInsertMock,
      }
    }
    if (table === 'users') {
      // First call: students (role/is_active filtered). Second call (only
      // reached if there's actually someone missing): staff for push targets.
      return {
        select: () => ({
          eq: () => ({ eq: () => Promise.resolve({ data: students, error: null }) }),
          in: () => Promise.resolve({ data: [{ id: 'staff-1' }], error: null }),
        }),
      }
    }
    if (table === 'daily_attendance') {
      return { select: () => ({ eq: () => Promise.resolve({ data: dailyRows, error: null }) }) }
    }
    if (table === 'attendance_excusals') {
      return { select: () => ({ eq: () => Promise.resolve({ data: excusals, error: null }) }) }
    }
    if (table === 'push_subscriptions') {
      return { select: () => ({ in: () => Promise.resolve({ data: [{ endpoint: 'e', p256dh: 'p', auth: 'a' }] }) }) }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { academySelectMock, sweepLogInsertMock }
}

function makeRequest(): Request {
  return new Request('http://localhost/api/cron/missed-checkin-sweep')
}

beforeEach(() => {
  adminFromMock.mockReset()
  sendPushNotificationMock.mockClear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('GET /api/cron/missed-checkin-sweep', () => {
  it('only ever sweeps AM — the response has no lunch key at all', async () => {
    jest.setSystemTime(new Date('2026-09-10T08:30:00Z')) // 09:30 London BST, past the 09:20 am deadline
    setupAdmin({ dailyRows: [] })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(Object.keys(json)).toEqual(['am'])
    expect(json.lunch).toBeUndefined()
  })

  it('only queries am_window_end from academy_settings, not lunch_window_end', async () => {
    jest.setSystemTime(new Date('2026-09-10T08:30:00Z'))
    const { academySelectMock } = setupAdmin({ dailyRows: [] })

    await GET(makeRequest())

    expect(academySelectMock).toHaveBeenCalledWith('am_window_end')
  })

  it('nudges staff for a student missing the AM check-in', async () => {
    jest.setSystemTime(new Date('2026-09-10T08:30:00Z'))
    setupAdmin({
      dailyRows: [{ student_id: 'student-1', am_checked_at: '2026-09-10T08:05:00Z' }],
    })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json.am).toEqual({ sent: 1, missing: 1 })
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    const [, payload] = sendPushNotificationMock.mock.calls[0] as [unknown, { title: string; body: string; url: string }]
    expect(payload.title).toMatch(/not checked in for morning/)
  })

  it('never nudges purely because lunch is missing — a student checked in for AM is left alone all sweep long', async () => {
    jest.setSystemTime(new Date('2026-09-10T08:30:00Z'))
    setupAdmin({
      dailyRows: [
        { student_id: 'student-1', am_checked_at: '2026-09-10T08:05:00Z' },
        { student_id: 'student-2', am_checked_at: '2026-09-10T08:06:00Z' },
      ],
    })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json.am).toEqual({ sent: 0, missing: 0 })
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })
})
