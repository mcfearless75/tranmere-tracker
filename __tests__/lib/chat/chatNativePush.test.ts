/**
 * @jest-environment node
 *
 * Regression coverage for: chat push notifications (`notifyRoomMembers`) and
 * chat nudges (`nudgeRoom`) only sent via web push (VAPID, `push_subscriptions`),
 * never via FCM (`native_push_tokens`) — so a user on the native iOS/Android
 * app never received a chat push or nudge at all, regardless of device
 * notification permission. Both functions must now send via both delivery
 * paths, independently of whether the other has any recipients, mirroring
 * app/api/push/send/route.ts.
 */
const CURRENT_USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'
const ROOM_ID = 'room-1'

// Declared before jest.mock so the factories below can close over them —
// jest.resetModules() re-invokes mock factories, so a jest.fn() created
// inline inside the factory would be a *different* instance each time the
// module is re-imported. Closing over an outer-scope mock keeps identity.
const sendPushNotificationMock = jest.fn(() => Promise.resolve())
const sendFcmBatchMock = jest.fn(() => Promise.resolve({ sent: 0, failed: 0 }))

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: CURRENT_USER_ID } } }) },
  }),
}))

jest.mock('@/lib/webpush', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...args),
}))

jest.mock('@/lib/firebase-admin', () => ({
  sendFcmBatch: (...args: unknown[]) => sendFcmBatchMock(...args),
}))

function makeAdminMock(opts: {
  isMember?: boolean
  webPushSubs?: { endpoint: string; p256dh: string; auth: string }[]
  nativeTokens?: string[]
}) {
  const { isMember = true, webPushSubs = [], nativeTokens = [] } = opts

  const chatMembersMaybeSingle = jest.fn(() =>
    Promise.resolve({ data: isMember ? { user_id: CURRENT_USER_ID } : null }),
  )
  // .eq('room_id', roomId).eq('user_id', userId).maybeSingle()  (isRoomMember)
  const chatMembersRoomEqUserEq = jest.fn(() => ({ maybeSingle: chatMembersMaybeSingle }))
  // .eq('room_id', roomId).neq('user_id', user.id)  (members list)
  const chatMembersRoomEqNeq = jest.fn(() =>
    Promise.resolve({ data: [{ user_id: OTHER_USER_ID }] }),
  )
  const chatMembersRoomEq = jest.fn(() => ({
    eq: chatMembersRoomEqUserEq,
    neq: chatMembersRoomEqNeq,
  }))
  const chatMembersSelect = jest.fn(() => ({ eq: chatMembersRoomEq }))

  const usersMaybeSingle = jest.fn(() => Promise.resolve({ data: { name: 'Sender Name' } }))
  const usersSingle = jest.fn(() => Promise.resolve({ data: { name: 'Sender Name' } }))
  const usersEq = jest.fn(() => ({ maybeSingle: usersMaybeSingle, single: usersSingle }))
  const usersSelect = jest.fn(() => ({ eq: usersEq }))

  const roomsSingle = jest.fn(() => Promise.resolve({ data: { name: 'Room Name', kind: 'custom' } }))
  const roomsEq = jest.fn(() => ({ single: roomsSingle }))
  const roomsSelect = jest.fn(() => ({ eq: roomsEq }))

  const pushSubsIn = jest.fn(() => Promise.resolve({ data: webPushSubs }))
  const pushSubsSelect = jest.fn(() => ({ in: pushSubsIn }))

  const nativeTokensIn = jest.fn(() =>
    Promise.resolve({ data: nativeTokens.map(token => ({ token })) }),
  )
  const nativeTokensSelect = jest.fn(() => ({ in: nativeTokensIn }))

  const from = jest.fn((table: string) => {
    if (table === 'chat_members') return { select: chatMembersSelect }
    if (table === 'users') return { select: usersSelect }
    if (table === 'chat_rooms') return { select: roomsSelect }
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

describe('notifyRoomMembers', () => {
  it('sends both web push and FCM when both kinds of recipients exist', async () => {
    const admin = makeAdminMock({
      webPushSubs: [{ endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' }],
      nativeTokens: ['fcm-token-1'],
    })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { notifyRoomMembers: fn } = await import('@/app/chat/actions')

    await fn(ROOM_ID, 'Ignored Name', 'hello there')

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).toHaveBeenCalledWith(
      ['fcm-token-1'],
      expect.objectContaining({ url: `/chat/${ROOM_ID}` }),
    )
  })

  it('still sends FCM when there are native tokens but no web push subscriptions', async () => {
    const admin = makeAdminMock({ webPushSubs: [], nativeTokens: ['fcm-token-1'] })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { notifyRoomMembers: fn } = await import('@/app/chat/actions')

    await fn(ROOM_ID, 'Ignored Name', 'hello there')

    expect(sendPushNotificationMock).not.toHaveBeenCalled()
    expect(sendFcmBatchMock).toHaveBeenCalledTimes(1)
  })

  it('still sends web push when there are web subscriptions but no native tokens', async () => {
    const admin = makeAdminMock({
      webPushSubs: [{ endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' }],
      nativeTokens: [],
    })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { notifyRoomMembers: fn } = await import('@/app/chat/actions')

    await fn(ROOM_ID, 'Ignored Name', 'hello there')

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).not.toHaveBeenCalled()
  })
})

describe('nudgeRoom', () => {
  it('sends both web push and FCM when both kinds of recipients exist', async () => {
    const admin = makeAdminMock({
      webPushSubs: [{ endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' }],
      nativeTokens: ['fcm-token-1'],
    })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { nudgeRoom: fn } = await import('@/app/chat/actions')

    const result = await fn(ROOM_ID)

    expect(result).toEqual({ ok: true })
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).toHaveBeenCalledWith(
      ['fcm-token-1'],
      expect.objectContaining({ url: `/chat/${ROOM_ID}` }),
    )
  })

  it('still sends FCM when there are native tokens but no web push subscriptions', async () => {
    const admin = makeAdminMock({ webPushSubs: [], nativeTokens: ['fcm-token-1'] })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { nudgeRoom: fn } = await import('@/app/chat/actions')

    const result = await fn(ROOM_ID)

    expect(result).toEqual({ ok: true })
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
    expect(sendFcmBatchMock).toHaveBeenCalledTimes(1)
  })
})
