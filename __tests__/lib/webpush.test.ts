/**
 * sendPushNotificationToUser must fan out to BOTH the web-push subscriptions
 * and the native (FCM/APNs) tokens a user holds, and a failure on one channel
 * must never suppress the other. Until 2026-09-10 it only ever read
 * push_subscriptions, so every staff alert routed through it (missed
 * check-in sweeps, safeguarding, GPS rejections, flagged check-ins, digests)
 * silently never reached anyone on the native app.
 */
const mockSendNotification = jest.fn()
jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}))

const mockSendFcmBatch = jest.fn()
jest.mock('@/lib/firebase-admin', () => ({
  sendFcmBatch: (...args: unknown[]) => mockSendFcmBatch(...args),
}))

import { sendPushNotificationToUser } from '@/lib/webpush'

type Row = Record<string, unknown>

/** Minimal chainable stub of the two Supabase queries the helper makes. */
function makeAdmin(tables: { push_subscriptions?: Row[]; native_push_tokens?: Row[] }) {
  const deleteIn = jest.fn().mockResolvedValue({ data: null, error: null })
  const admin = {
    from: jest.fn((table: string) => ({
      select: () => ({
        eq: () =>
          Promise.resolve({ data: tables[table as keyof typeof tables] ?? [], error: null }),
      }),
      delete: () => ({ in: deleteIn }),
    })),
  }
  return { admin, deleteIn }
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.VAPID_SUBJECT = 'mailto:test@example.com'
  process.env.VAPID_PUBLIC_KEY = 'pub'
  process.env.VAPID_PRIVATE_KEY = 'priv'
  mockSendNotification.mockResolvedValue({ statusCode: 201 })
  mockSendFcmBatch.mockResolvedValue({ sent: 1, failed: 0 })
})

describe('sendPushNotificationToUser', () => {
  it('sends to web-push subscriptions AND native tokens with the same payload', async () => {
    const { admin } = makeAdmin({
      push_subscriptions: [{ endpoint: 'https://push/1', p256dh: 'k', auth: 'a' }],
      native_push_tokens: [{ token: 'fcm-token-1' }, { token: 'fcm-token-2' }],
    })

    await sendPushNotificationToUser(admin as never, 'user-1', 'Title', 'Body', '/admin/attendance')

    expect(mockSendNotification).toHaveBeenCalledTimes(1)
    expect(JSON.parse(mockSendNotification.mock.calls[0][1] as string)).toEqual({
      title: 'Title',
      body: 'Body',
      url: '/admin/attendance',
    })
    expect(mockSendFcmBatch).toHaveBeenCalledWith(['fcm-token-1', 'fcm-token-2'], {
      title: 'Title',
      body: 'Body',
      url: '/admin/attendance',
    })
  })

  it('still reaches native devices when the user has no web-push subscription (the pre-fix gap)', async () => {
    const { admin } = makeAdmin({ native_push_tokens: [{ token: 'fcm-only' }] })

    await sendPushNotificationToUser(admin as never, 'user-1', 'T', 'B')

    expect(mockSendNotification).not.toHaveBeenCalled()
    expect(mockSendFcmBatch).toHaveBeenCalledWith(['fcm-only'], { title: 'T', body: 'B', url: undefined })
  })

  it('does not touch firebase when there are no native tokens', async () => {
    const { admin } = makeAdmin({ push_subscriptions: [{ endpoint: 'https://push/1', p256dh: 'k', auth: 'a' }] })

    await sendPushNotificationToUser(admin as never, 'user-1', 'T', 'B')

    expect(mockSendFcmBatch).not.toHaveBeenCalled()
  })

  it('keeps the native channel alive when the web-push channel throws', async () => {
    mockSendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }))
    const { admin } = makeAdmin({
      push_subscriptions: [{ endpoint: 'https://push/1', p256dh: 'k', auth: 'a' }],
      native_push_tokens: [{ token: 'fcm-token-1' }],
    })
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(sendPushNotificationToUser(admin as never, 'user-1', 'T', 'B')).resolves.toBeUndefined()

    expect(mockSendFcmBatch).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })

  it('never throws when the native channel fails', async () => {
    mockSendFcmBatch.mockRejectedValue(new Error('fcm down'))
    const { admin } = makeAdmin({ native_push_tokens: [{ token: 'fcm-token-1' }] })
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(sendPushNotificationToUser(admin as never, 'user-1', 'T', 'B')).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalledWith('[webpush] native/FCM channel failed:', expect.any(Error))
    errSpy.mockRestore()
  })

  it('prunes web-push subscriptions the push service reports as gone (404/410)', async () => {
    mockSendNotification.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
    const { admin, deleteIn } = makeAdmin({
      push_subscriptions: [{ endpoint: 'https://push/dead', p256dh: 'k', auth: 'a' }],
    })

    await sendPushNotificationToUser(admin as never, 'user-1', 'T', 'B')

    expect(deleteIn).toHaveBeenCalledWith('endpoint', ['https://push/dead'])
  })
})
