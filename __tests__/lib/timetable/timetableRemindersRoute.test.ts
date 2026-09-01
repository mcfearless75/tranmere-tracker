/**
 * @jest-environment node
 */

const verifyCronSecretMock = jest.fn()
const londonDateISOMock = jest.fn()
const londonWeekdayMock = jest.fn()
const getSlotsDueForReminderMock = jest.fn()
const sendPushNotificationMock = jest.fn()
const sendFcmBatchMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/security', () => ({
  verifyCronSecret: (...args: unknown[]) => verifyCronSecretMock(...args),
}))
jest.mock('@/lib/dates', () => ({
  londonDateISO: (...args: unknown[]) => londonDateISOMock(...args),
  londonWeekday: (...args: unknown[]) => londonWeekdayMock(...args),
}))
jest.mock('@/lib/timetable/timetableUtils', () => ({
  getSlotsDueForReminder: (...args: unknown[]) => getSlotsDueForReminderMock(...args),
}))
jest.mock('@/lib/webpush', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...args),
}))
jest.mock('@/lib/firebase-admin', () => ({
  sendFcmBatch: (...args: unknown[]) => sendFcmBatchMock(...args),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))

import { GET } from '@/app/api/cron/timetable-reminders/route'

function makeRequest(): Request {
  return new Request('http://localhost/api/cron/timetable-reminders', {
    headers: { authorization: 'Bearer test-secret' },
  })
}

const SLOT = {
  id: 'slot1', year_group: 1, day_of_week: 1,
  start_time: '10:00:00', end_time: '11:00:00',
  title: 'Football 1', location: 'Pitch 1',
}

type SetupOpts = {
  todaysSlots?: Array<typeof SLOT>
  alreadySent?: Array<{ slot_id: string }>
  students?: Array<{ id: string }>
  subs?: Array<{ endpoint: string; p256dh: string; auth: string }>
  tokens?: string[]
}

function setupAdmin(opts: SetupOpts = {}) {
  const {
    todaysSlots = [SLOT],
    alreadySent = [],
    students = [{ id: 'student1' }],
    subs = [],
    tokens = [],
  } = opts
  const insertMock = jest.fn(async () => ({ error: null }))
  const deleteInMock = jest.fn(async () => ({ error: null }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'timetable_slots') {
      return { select: () => ({ eq: async () => ({ data: todaysSlots, error: null }) }) }
    }
    if (table === 'timetable_reminder_log') {
      return {
        select: () => ({ eq: () => ({ in: async () => ({ data: alreadySent, error: null }) }) }),
        insert: insertMock,
      }
    }
    if (table === 'users') {
      return { select: () => ({ eq: () => ({ eq: async () => ({ data: students, error: null }) }) }) }
    }
    if (table === 'push_subscriptions') {
      return {
        select: () => ({ in: async () => ({ data: subs, error: null }) }),
        delete: () => ({ in: deleteInMock }),
      }
    }
    if (table === 'native_push_tokens') {
      return { select: () => ({ in: async () => ({ data: tokens.map(t => ({ token: t })), error: null }) }) }
    }
    throw new Error(`Unexpected table ${table}`)
  })

  return { insertMock, deleteInMock }
}

beforeEach(() => {
  verifyCronSecretMock.mockReset()
  londonDateISOMock.mockReset()
  londonWeekdayMock.mockReset()
  getSlotsDueForReminderMock.mockReset()
  sendPushNotificationMock.mockReset()
  sendFcmBatchMock.mockReset()
  adminFromMock.mockReset()

  verifyCronSecretMock.mockReturnValue(true)
  londonDateISOMock.mockReturnValue('2026-09-07')
  londonWeekdayMock.mockReturnValue(1)
  getSlotsDueForReminderMock.mockReturnValue([SLOT])
  sendPushNotificationMock.mockResolvedValue(undefined)
  sendFcmBatchMock.mockResolvedValue({ sent: 0, failed: 0 })
})

describe('GET /api/cron/timetable-reminders', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    verifyCronSecretMock.mockReturnValue(false)
    setupAdmin()
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns sent: 0 when there are no slots today', async () => {
    setupAdmin({ todaysSlots: [] })
    const res = await GET(makeRequest())
    expect(await res.json()).toEqual({ sent: 0, slots: 0 })
  })

  it('returns sent: 0 when no slot is due yet', async () => {
    getSlotsDueForReminderMock.mockReturnValue([])
    setupAdmin()
    const res = await GET(makeRequest())
    expect(await res.json()).toEqual({ sent: 0, slots: 0 })
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('skips a slot already logged as sent today', async () => {
    setupAdmin({ alreadySent: [{ slot_id: 'slot1' }] })
    const res = await GET(makeRequest())
    expect(await res.json()).toEqual({ sent: 0, slots: 0 })
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('sends push + FCM to the slot year-group and logs the send', async () => {
    const { insertMock } = setupAdmin({
      subs: [{ endpoint: 'https://push.example/1', p256dh: 'p256dh', auth: 'auth' }],
      tokens: ['tok1'],
    })
    sendFcmBatchMock.mockResolvedValue({ sent: 1, failed: 0 })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).toHaveBeenCalledTimes(1)
    expect(json).toEqual({ sent: 2, slots: 1 })
    expect(insertMock).toHaveBeenCalledWith({ slot_id: 'slot1', session_date: '2026-09-07' })
  })

  it('still logs the slot as sent when there are no matching students', async () => {
    const { insertMock } = setupAdmin({ students: [] })
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json).toEqual({ sent: 0, slots: 1 })
    expect(insertMock).toHaveBeenCalledWith({ slot_id: 'slot1', session_date: '2026-09-07' })
  })
})
