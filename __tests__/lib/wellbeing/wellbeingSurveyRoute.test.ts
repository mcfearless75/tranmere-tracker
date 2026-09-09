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
import { GET } from '@/app/api/cron/wellbeing-survey/route'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/cron/wellbeing-survey')
}

/** Wires the admin client for the two tables this route touches. */
function setupAdmin(opts: {
  students?: { id: string }[]
  existingOpenStudentIds?: string[]
  insertError?: { message: string } | null
} = {}) {
  const {
    students = [{ id: 'student-1' }, { id: 'student-2' }],
    existingOpenStudentIds = [],
    insertError = null,
  } = opts

  const insertMock = jest.fn(() => Promise.resolve({ error: insertError }))

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
    if (table === 'wellbeing_surveys') {
      return {
        select: () => ({
          eq: () => ({
            gte: () => Promise.resolve({ data: existingOpenStudentIds.map(id => ({ student_id: id })) }),
          }),
        }),
        insert: insertMock,
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { insertMock }
}

beforeEach(() => {
  adminFromMock.mockReset()
  notifyUsersMock.mockClear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('GET /api/cron/wellbeing-survey', () => {
  it('sends on an ISO week that the old fortnightly gate would have skipped', async () => {
    // 2024-01-08 is ISO week 2 (even) — the old isFortnightlyWeek gate returned
    // false for this date and the route would have skipped entirely.
    jest.setSystemTime(new Date('2024-01-08T09:00:00Z'))
    setupAdmin()
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json).toEqual({ sent: 2 })
  })

  it('sends on an ISO week the old gate would also have fired on (regression guard)', async () => {
    // 2024-01-01 is ISO week 1 (odd) — old gate would have fired here too.
    jest.setSystemTime(new Date('2024-01-01T09:00:00Z'))
    setupAdmin()
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json).toEqual({ sent: 2 })
  })

  it('skips a student who already has an open survey this week', async () => {
    jest.setSystemTime(new Date('2024-01-08T09:00:00Z'))
    const { insertMock } = setupAdmin({ existingOpenStudentIds: ['student-1'] })
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json).toEqual({ sent: 1 })
    expect(insertMock).toHaveBeenCalledWith([{ student_id: 'student-2', status: 'open' }])
    expect(notifyUsersMock).toHaveBeenCalledWith(
      expect.anything(),
      ['student-2'],
      expect.anything()
    )
  })

  it('notifies via notifyUsers with the weekly copy, not the old per-subscription push', async () => {
    jest.setSystemTime(new Date('2024-01-08T09:00:00Z'))
    setupAdmin()
    await GET(makeRequest())
    expect(notifyUsersMock).toHaveBeenCalledTimes(1)
    const [, userIds, notification] = notifyUsersMock.mock.calls[0]
    expect(userIds.sort()).toEqual(['student-1', 'student-2'])
    expect(notification).toEqual(
      expect.objectContaining({
        title: 'Wellbeing Check-in 💙',
        url: '/wellbeing',
      })
    )
    expect(notification.body).toMatch(/weekly/i)
    expect(notification.body).not.toMatch(/fortnightly/i)
  })
})
