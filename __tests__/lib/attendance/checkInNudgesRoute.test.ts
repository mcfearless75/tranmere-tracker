/**
 * @jest-environment node
 */
const adminFromMock = jest.fn()
const notifyUsersMock = jest.fn(() => Promise.resolve())

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))
jest.mock('@/lib/security', () => ({
  verifyCronSecret: () => true,
}))
jest.mock('@/lib/notifications/notifyStaff', () => ({
  notifyUsers: (...args: unknown[]) => notifyUsersMock(...args),
}))

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/cron/check-in-nudges/route'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/cron/check-in-nudges')
}

/** Wires the admin client for the two tables this route touches. */
function setupAdmin(opts: {
  students?: { id: string; name: string }[]
  dailyRows?: { student_id: string; am_checked_at: string | null; lunch_checked_at: string | null; pm_checked_at: string | null }[]
} = {}) {
  const {
    students = [{ id: 'student-1', name: 'Alice' }, { id: 'student-2', name: 'Bob' }],
    dailyRows = [],
  } = opts

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: students, error: null }),
          }),
        }),
      }
    }
    if (table === 'daily_attendance') {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: dailyRows, error: null }),
        }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

beforeEach(() => {
  adminFromMock.mockReset()
  notifyUsersMock.mockClear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('GET /api/cron/check-in-nudges', () => {
  // Confirmed live 2026-09-10: this route queried push_subscriptions and
  // called sendPushNotification directly — web-push only, the exact gap
  // already fixed for wellbeing/chat that night — so a native app (iOS/
  // Android) user never received these reminders regardless of their
  // notification permission. Reusing notifyUsers closes it here too.
  it('notifies via notifyUsers (dual-channel), not a direct push_subscriptions query', async () => {
    jest.setSystemTime(new Date('2026-09-10T08:00:00Z')) // 09:00 London BST -> am
    setupAdmin()
    await GET(makeRequest())
    expect(notifyUsersMock).toHaveBeenCalledTimes(1)
    const [, userIds, notification] = notifyUsersMock.mock.calls[0]
    expect(userIds.sort()).toEqual(['student-1', 'student-2'])
    expect(notification).toEqual(
      expect.objectContaining({ title: 'Morning check-in', url: '/attendance' }),
    )
  })

  it('only nudges students who have not yet checked in for the current phase', async () => {
    jest.setSystemTime(new Date('2026-09-10T08:00:00Z')) // am
    setupAdmin({
      dailyRows: [{ student_id: 'student-1', am_checked_at: '2026-09-10T09:05:00Z', lunch_checked_at: null, pm_checked_at: null }],
    })
    await GET(makeRequest())
    const [, userIds] = notifyUsersMock.mock.calls[0]
    expect(userIds).toEqual(['student-2'])
  })

  it('sends the end-of-day copy during the pm nudge window', async () => {
    jest.setSystemTime(new Date('2026-09-10T15:00:00Z')) // 16:00 London BST -> pm
    setupAdmin()
    await GET(makeRequest())
    const [, , notification] = notifyUsersMock.mock.calls[0]
    expect(notification).toEqual(
      expect.objectContaining({ title: 'End-of-day check-in' }),
    )
    expect(notification.body).toMatch(/tap out/i)
  })

  it('does not call notifyUsers when everyone has already checked in', async () => {
    jest.setSystemTime(new Date('2026-09-10T08:00:00Z'))
    setupAdmin({
      dailyRows: [
        { student_id: 'student-1', am_checked_at: '2026-09-10T09:05:00Z', lunch_checked_at: null, pm_checked_at: null },
        { student_id: 'student-2', am_checked_at: '2026-09-10T09:06:00Z', lunch_checked_at: null, pm_checked_at: null },
      ],
    })
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json).toEqual({ sent: 0, phase: 'am' })
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })
})
