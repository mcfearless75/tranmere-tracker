/**
 * @jest-environment node
 *
 * DST dual-schedule coverage for attendance-report-am/pm. vercel.json now
 * fires each route twice (BST and GMT UTC times for the same London
 * wall-clock target) — only the invocation landing on the intended London
 * hour should send. Same self-correcting pattern as lunch-ending.
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

function setupAdmin() {
  adminFromMock.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({ eq: () => Promise.resolve({ data: [{ id: 'student-1', name: 'Alice' }], error: null }) }),
          in: () => Promise.resolve({ data: [{ id: 'staff-1' }], error: null }),
        }),
      }
    }
    if (table === 'daily_attendance') {
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
    }
    if (table === 'push_subscriptions') {
      return { select: () => ({ in: () => Promise.resolve({ data: [{ endpoint: 'e', p256dh: 'p', auth: 'a' }] }) }) }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

beforeEach(() => {
  adminFromMock.mockReset()
  sendPushNotificationMock.mockClear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('GET /api/cron/attendance-report-am', () => {
  it('sends at 10:30 London time (either UTC schedule)', async () => {
    const { GET } = await import('@/app/api/cron/attendance-report-am/route')
    jest.setSystemTime(new Date('2026-09-10T09:30:00Z')) // 10:30 London BST
    setupAdmin()
    const res = await GET(new Request('http://localhost/api/cron/attendance-report-am'))
    const json = await res.json()
    expect(json.sent).toBe(1)
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
  })

  it('skips the invocation that is not actually 10:30 London time', async () => {
    const { GET } = await import('@/app/api/cron/attendance-report-am/route')
    jest.setSystemTime(new Date('2026-09-10T08:30:00Z')) // 9:30 London BST — the GMT-side schedule, an hour off today
    setupAdmin()
    const res = await GET(new Request('http://localhost/api/cron/attendance-report-am'))
    const json = await res.json()
    expect(json).toEqual({ skipped: true, reason: 'not 10:30 London time', londonHour: 9 })
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/attendance-report-pm', () => {
  it('sends at 17:30 London time (either UTC schedule)', async () => {
    const { GET } = await import('@/app/api/cron/attendance-report-pm/route')
    jest.setSystemTime(new Date('2026-09-10T16:30:00Z')) // 17:30 London BST
    setupAdmin()
    const res = await GET(new Request('http://localhost/api/cron/attendance-report-pm'))
    const json = await res.json()
    expect(json.sent).toBe(1)
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
  })

  it('skips the invocation that is not actually 17:30 London time', async () => {
    const { GET } = await import('@/app/api/cron/attendance-report-pm/route')
    jest.setSystemTime(new Date('2026-09-10T17:30:00Z')) // 18:30 London BST — the GMT-side schedule, an hour off today
    setupAdmin()
    const res = await GET(new Request('http://localhost/api/cron/attendance-report-pm'))
    const json = await res.json()
    expect(json).toEqual({ skipped: true, reason: 'not 17:30 London time', londonHour: 18 })
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })
})
