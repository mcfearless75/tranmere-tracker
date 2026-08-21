/**
 * @jest-environment node
 *
 * Unit tests for the calendar-reminders cron route.
 * Runs in the node environment so the Web Request/Response globals used by
 * NextResponse are available (jsdom does not provide them).
 * lib/security, lib/dates, lib/webpush, lib/firebase-admin and the Supabase
 * admin client are all mocked so the handler's own logic (auth gate, 9am
 * London gate, event lookup, push fan-out, idempotency update) can be tested
 * in isolation without a live database or push infrastructure.
 */

const verifyCronSecretMock = jest.fn()
const londonHourMock = jest.fn()
const londonDateISOMock = jest.fn()
const sendPushNotificationMock = jest.fn()
const sendFcmBatchMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/security', () => ({
  verifyCronSecret: (...args: unknown[]) => verifyCronSecretMock(...args),
}))

jest.mock('@/lib/dates', () => ({
  londonHour: (...args: unknown[]) => londonHourMock(...args),
  londonDateISO: (...args: unknown[]) => londonDateISOMock(...args),
}))

jest.mock('@/lib/webpush', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...args),
}))

jest.mock('@/lib/firebase-admin', () => ({
  sendFcmBatch: (...args: unknown[]) => sendFcmBatchMock(...args),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: adminFromMock,
  }),
}))

import { GET } from '@/app/api/cron/calendar-reminders/route'

function makeRequest(): Request {
  return new Request('http://localhost/api/cron/calendar-reminders', {
    headers: { authorization: 'Bearer test-secret' },
  })
}

type SetupOpts = {
  events?: Array<{ id: string; title: string; event_time: string | null; description: string | null }>
  subs?: Array<{ endpoint: string; p256dh: string; auth: string }>
  tokens?: string[]
}

/** Builds the admin .from() router used by the handler. */
function setupAdmin(opts: SetupOpts = {}) {
  const { events = [], subs = [], tokens = [] } = opts
  const updateMock = jest.fn((_body: Record<string, unknown>) => ({
    eq: async () => ({ error: null }),
  }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'calendar_events') {
      return {
        select: () => ({
          eq: () => ({
            is: async () => ({ data: events, error: null }),
          }),
        }),
        update: updateMock,
      }
    }
    if (table === 'push_subscriptions') {
      return {
        select: async () => ({ data: subs, error: null }),
        delete: () => ({ in: async () => ({ error: null }) }),
      }
    }
    if (table === 'native_push_tokens') {
      return {
        select: async () => ({ data: tokens.map(t => ({ token: t })), error: null }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })

  return { updateMock }
}

beforeEach(() => {
  verifyCronSecretMock.mockReset()
  londonHourMock.mockReset()
  londonDateISOMock.mockReset()
  sendPushNotificationMock.mockReset()
  sendFcmBatchMock.mockReset()
  adminFromMock.mockReset()

  verifyCronSecretMock.mockReturnValue(true)
  londonHourMock.mockReturnValue(9)
  londonDateISOMock.mockReturnValue('2026-08-21')
  sendPushNotificationMock.mockResolvedValue(undefined)
  sendFcmBatchMock.mockResolvedValue({ sent: 0, failed: 0 })
})

describe('GET /api/cron/calendar-reminders', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    verifyCronSecretMock.mockReturnValue(false)
    setupAdmin()
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('skips when it is not 9am London time', async () => {
    londonHourMock.mockReturnValue(8)
    setupAdmin()
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json.skipped).toBe(true)
    expect(json.londonHour).toBe(8)
  })

  it('returns sent: 0, events: 0 when no events match', async () => {
    setupAdmin({ events: [] })
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json).toEqual({ sent: 0, events: 0 })
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
    expect(sendFcmBatchMock).not.toHaveBeenCalled()
  })

  it('sends push + FCM for a matching event and sets reminder_sent_at', async () => {
    const { updateMock } = setupAdmin({
      events: [{ id: 'e1', title: 'Test Event', event_time: '18:30:00', description: 'desc' }],
      subs: [{ endpoint: 'https://push.example/1', p256dh: 'p256dh', auth: 'auth' }],
      tokens: ['tok1'],
    })
    sendFcmBatchMock.mockResolvedValue({ sent: 1, failed: 0 })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).toHaveBeenCalledTimes(1)
    expect(json).toEqual({ sent: 2, events: 1 })

    expect(updateMock).toHaveBeenCalledTimes(1)
    const updatePayload = updateMock.mock.calls[0][0] as { reminder_sent_at: unknown }
    expect(updatePayload.reminder_sent_at).not.toBeNull()
    expect(typeof updatePayload.reminder_sent_at).toBe('string')
  })
})
