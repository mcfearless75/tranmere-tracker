/**
 * @jest-environment node
 */
const sendPushNotificationMock = jest.fn(() => Promise.resolve())
const sendFcmBatchMock = jest.fn(() => Promise.resolve({ sent: 0, failed: 0 }))

jest.mock('@/lib/webpush', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...args),
}))
jest.mock('@/lib/firebase-admin', () => ({
  sendFcmBatch: (...args: unknown[]) => sendFcmBatchMock(...args),
}))

import { notifyUsers } from '@/lib/notifications/notifyStaff'

const NOTIFICATION = { title: 'T', body: 'B', url: '/u' }

/** Minimal admin-client double — only implements .from() for the two tables notifyUsers reads. */
function makeAdminMock(opts: {
  webPushSubs?: { endpoint: string; p256dh: string; auth: string }[]
  nativeTokens?: string[]
} = {}) {
  const { webPushSubs = [], nativeTokens = [] } = opts

  const pushSubsIn = jest.fn(() => Promise.resolve({ data: webPushSubs }))
  const pushSubsSelect = jest.fn(() => ({ in: pushSubsIn }))

  const nativeTokensIn = jest.fn(() => Promise.resolve({ data: nativeTokens.map(token => ({ token })) }))
  const nativeTokensSelect = jest.fn(() => ({ in: nativeTokensIn }))

  const from = jest.fn((table: string) => {
    if (table === 'push_subscriptions') return { select: pushSubsSelect }
    if (table === 'native_push_tokens') return { select: nativeTokensSelect }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from }
}

beforeEach(() => {
  sendPushNotificationMock.mockClear()
  sendFcmBatchMock.mockClear()
})

describe('notifyUsers', () => {
  it('does nothing when userIds is empty', async () => {
    const admin = makeAdminMock()
    await notifyUsers(admin as any, [], NOTIFICATION)
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('sends both web push and FCM when both kinds of recipients exist', async () => {
    const admin = makeAdminMock({
      webPushSubs: [{ endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' }],
      nativeTokens: ['fcm-token-1'],
    })
    await notifyUsers(admin as any, ['user-1'], NOTIFICATION)
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).toHaveBeenCalledWith(['fcm-token-1'], NOTIFICATION)
  })

  it('still sends FCM when there are native tokens but no web push subscriptions', async () => {
    const admin = makeAdminMock({ nativeTokens: ['fcm-token-1'] })
    await notifyUsers(admin as any, ['user-1'], NOTIFICATION)
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
    expect(sendFcmBatchMock).toHaveBeenCalledTimes(1)
  })

  it('still sends web push when there are subscriptions but no native tokens', async () => {
    const admin = makeAdminMock({ webPushSubs: [{ endpoint: 'e', p256dh: 'p', auth: 'a' }] })
    await notifyUsers(admin as any, ['user-1'], NOTIFICATION)
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).not.toHaveBeenCalled()
  })

  it('swallows errors and never throws', async () => {
    const admin = { from: jest.fn(() => { throw new Error('boom') }) }
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(notifyUsers(admin as any, ['user-1'], NOTIFICATION)).resolves.toBeUndefined()
    errorSpy.mockRestore()
  })

  it('still attempts FCM even when web-push query fails (channel independence)', async () => {
    // web-push query throws, but native-push query should succeed
    const admin = {
      from: jest.fn((table: string) => {
        if (table === 'push_subscriptions') {
          throw new Error('push_subscriptions query failed')
        }
        if (table === 'native_push_tokens') {
          return {
            select: jest.fn(() => ({
              in: jest.fn(() => Promise.resolve({ data: [{ token: 'fcm-token-1' }] })),
            })),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await notifyUsers(admin as any, ['user-1'], NOTIFICATION)

    // Verify that even though web-push failed, FCM was still attempted
    expect(sendFcmBatchMock).toHaveBeenCalledWith(['fcm-token-1'], NOTIFICATION)
    expect(sendPushNotificationMock).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('prunes a push subscription whose send failed with 404/410 (expired/revoked)', async () => {
    sendPushNotificationMock.mockRejectedValueOnce(
      Object.assign(new Error('Gone'), { statusCode: 410 })
    )
    const deleteIn = jest.fn(() => Promise.resolve({ data: null, error: null }))
    const admin = {
      from: jest.fn((table: string) => {
        if (table === 'push_subscriptions') {
          return {
            select: jest.fn(() => ({
              in: jest.fn(() =>
                Promise.resolve({ data: [{ endpoint: 'https://push.example/dead', p256dh: 'p', auth: 'a' }] })
              ),
            })),
            delete: jest.fn(() => ({ in: deleteIn })),
          }
        }
        if (table === 'native_push_tokens') {
          return { select: jest.fn(() => ({ in: jest.fn(() => Promise.resolve({ data: [] })) })) }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    await notifyUsers(admin as any, ['user-1'], NOTIFICATION)

    expect(deleteIn).toHaveBeenCalledWith('endpoint', ['https://push.example/dead'])
  })
})
