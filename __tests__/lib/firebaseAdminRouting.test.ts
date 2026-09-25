const mockSendApnsBatch = jest.fn()
jest.mock('@/lib/apns', () => ({
  ...jest.requireActual('@/lib/apns'),
  sendApnsBatch: (...args: unknown[]) => mockSendApnsBatch(...args),
}))
const mockFcmSend = jest.fn()
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  cert: jest.fn(),
}))
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ send: (...args: unknown[]) => mockFcmSend(...args) }),
}))

import { sendFcmBatch } from '@/lib/firebase-admin'

describe('sendFcmBatch — iOS/Android routing', () => {
  beforeAll(() => { process.env.FIREBASE_SERVICE_ACCOUNT = '{}' })

  it('sends APNs device tokens to APNs and FCM tokens to FCM, summing the results', async () => {
    mockSendApnsBatch.mockResolvedValue({ sent: 1, failed: 0 })
    mockFcmSend.mockResolvedValue('ok')
    const apnsToken = 'f'.repeat(64)
    const fcmToken = 'abc:APA91b' + 'x'.repeat(130)

    const r = await sendFcmBatch([apnsToken, fcmToken], { title: 'Hi', body: 'Msg', url: '/chat/1' })

    expect(mockSendApnsBatch).toHaveBeenCalledWith([apnsToken], { title: 'Hi', body: 'Msg', url: '/chat/1' })
    expect(mockFcmSend).toHaveBeenCalledTimes(1)
    expect(mockFcmSend.mock.calls[0][0].token).toBe(fcmToken)
    expect(r).toEqual({ sent: 2, failed: 0 })
  })
})
