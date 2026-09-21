export {}

/**
 * @jest-environment node
 *
 * Coverage for Task 6: notifyRoomMembers's optional 4th `replyToUserId`
 * argument. The replied-to member gets a distinct "X replied to you" title;
 * everyone else in the room gets the normal sender-name title. Both groups
 * must still go through both web push (VAPID) and native push (FCM) — see
 * chatNativePush.test.ts, which this file models its mocking shape on.
 */
const CURRENT_USER_ID = 'u1'
const ROOM_ID = 'room-1'
const SENDER_NAME = 'Coach Phil'

// Declared before jest.mock so the factories below can close over them —
// jest.resetModules() re-invokes mock factories, so a jest.fn() created
// inline inside the factory would be a *different* instance each time the
// module is re-imported. Closing over an outer-scope mock keeps identity.
const sendPushNotificationMock = jest.fn((..._args: unknown[]) => Promise.resolve())
const sendFcmBatchMock = jest.fn((..._args: unknown[]) => Promise.resolve({ sent: 0, failed: 0 }))

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

// Room has two other members, u2 and u3, each with one web push subscription
// (keyed by a distinguishable endpoint) and one native token.
const MEMBER_IDS = ['u2', 'u3']
const WEB_PUSH_SUBS = MEMBER_IDS.map(id => ({
  user_id: id,
  endpoint: `endpoint-${id}`,
  p256dh: `p256dh-${id}`,
  auth: `auth-${id}`,
}))
const NATIVE_TOKENS = MEMBER_IDS.map(id => ({ user_id: id, token: `token-${id}` }))

function makeAdminMock() {
  const chatMembersMaybeSingle = jest.fn(() =>
    Promise.resolve({ data: { user_id: CURRENT_USER_ID } }),
  )
  // .eq('room_id', roomId).eq('user_id', userId).maybeSingle()  (isRoomMember)
  const chatMembersRoomEqUserEq = jest.fn(() => ({ maybeSingle: chatMembersMaybeSingle }))
  // .eq('room_id', roomId).neq('user_id', user.id)  (members list)
  const chatMembersRoomEqNeq = jest.fn(() =>
    Promise.resolve({ data: MEMBER_IDS.map(id => ({ user_id: id })) }),
  )
  const chatMembersRoomEq = jest.fn(() => ({
    eq: chatMembersRoomEqUserEq,
    neq: chatMembersRoomEqNeq,
  }))
  const chatMembersSelect = jest.fn(() => ({ eq: chatMembersRoomEq }))

  const usersMaybeSingle = jest.fn(() => Promise.resolve({ data: { name: SENDER_NAME } }))
  const usersEq = jest.fn(() => ({ maybeSingle: usersMaybeSingle }))
  const usersSelect = jest.fn(() => ({ eq: usersEq }))

  // push_subscriptions and native_push_tokens are filtered per notification
  // group via .in('user_id', ids) — return only the rows matching that group.
  const pushSubsIn = jest.fn((_col: string, ids: string[]) =>
    Promise.resolve({ data: WEB_PUSH_SUBS.filter(s => ids.includes(s.user_id)) }),
  )
  const pushSubsSelect = jest.fn(() => ({ in: pushSubsIn }))

  const nativeTokensIn = jest.fn((_col: string, ids: string[]) =>
    Promise.resolve({ data: NATIVE_TOKENS.filter(t => ids.includes(t.user_id)) }),
  )
  const nativeTokensSelect = jest.fn(() => ({ in: nativeTokensIn }))

  const from = jest.fn((table: string) => {
    if (table === 'chat_members') return { select: chatMembersSelect }
    if (table === 'users') return { select: usersSelect }
    if (table === 'push_subscriptions') return { select: pushSubsSelect }
    if (table === 'native_push_tokens') return { select: nativeTokensSelect }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from }
}

async function loadNotifyRoomMembers() {
  const admin = makeAdminMock()
  jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
  jest.resetModules()
  const { notifyRoomMembers } = await import('@/app/chat/actions')
  return notifyRoomMembers
}

beforeEach(() => {
  sendPushNotificationMock.mockClear()
  sendFcmBatchMock.mockClear()
})

describe('notifyRoomMembers reply targeting', () => {
  it('titles every push with the sender name when no reply target is given', async () => {
    const notifyRoomMembers = await loadNotifyRoomMembers()
    await notifyRoomMembers(ROOM_ID, 'ignored', 'On my way')

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(2)
    for (const call of sendPushNotificationMock.mock.calls) {
      expect((call[1] as { title: string }).title).toBe(SENDER_NAME)
    }
  })

  it('titles the replied-to user differently from everyone else', async () => {
    const notifyRoomMembers = await loadNotifyRoomMembers()
    await notifyRoomMembers(ROOM_ID, 'ignored', 'On my way', 'u2')

    const titlesByEndpoint = Object.fromEntries(
      sendPushNotificationMock.mock.calls.map(c => [
        (c[0] as { endpoint: string }).endpoint,
        (c[1] as { title: string }).title,
      ]),
    )
    expect(titlesByEndpoint['endpoint-u2']).toBe(`${SENDER_NAME} replied to you`)
    expect(titlesByEndpoint['endpoint-u3']).toBe(SENDER_NAME)
  })

  it('still sends native FCM to both groups', async () => {
    const notifyRoomMembers = await loadNotifyRoomMembers()
    await notifyRoomMembers(ROOM_ID, 'ignored', 'On my way', 'u2')

    const allTokens = sendFcmBatchMock.mock.calls.flatMap(c => c[0] as string[])
    expect(allTokens).toEqual(expect.arrayContaining(['token-u2', 'token-u3']))
  })

  it('ignores a reply target who is not in the room', async () => {
    const notifyRoomMembers = await loadNotifyRoomMembers()
    await notifyRoomMembers(ROOM_ID, 'ignored', 'On my way', 'stranger')

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(2)
    for (const call of sendPushNotificationMock.mock.calls) {
      expect((call[1] as { title: string }).title).toBe(SENDER_NAME)
    }
  })
})
