/**
 * @jest-environment node
 *
 * Regression coverage for the "You're not a member of this conversation"
 * bug confirmed live 2026-09-07: chat_members.user_id has a hard FK to
 * users(id), and a single multi-row insert is all-or-nothing in Postgres —
 * if the bot user's row didn't exist in public.users, the WHOLE insert
 * failed silently (the code never checked the error), leaving a chat_rooms
 * row with zero members that "succeeded" from the caller's point of view.
 * getOrCreateDM and createGroupChat share the identical unchecked-insert
 * pattern, just never hit it because real user ids always exist. All three
 * now check the error and roll back the orphaned room instead of returning
 * fake success. See supabase/migrations/061_seed_chat_bot_user.sql for the
 * root-cause data fix.
 */
import { getOrCreateBotRoom, getOrCreateDM } from '@/app/chat/actions'

const CURRENT_USER_ID = 'user-1'

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: CURRENT_USER_ID } } }) },
  }),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

function makeAdminMock(opts: {
  existingRoomId?: string | null
  existingRoomKind?: string
  newRoomId?: string
  roomInsertError?: { message: string } | null
  memberInsertError?: { message: string } | null
}) {
  const {
    existingRoomId = null,
    existingRoomKind = 'bot',
    newRoomId = 'new-room-1',
    roomInsertError = null,
    memberInsertError = null,
  } = opts

  const chatMembersSelectEq = jest.fn(() =>
    Promise.resolve({
      data: existingRoomId
        ? [{ room_id: existingRoomId, chat_rooms: { kind: existingRoomKind } }]
        : [],
    }),
  )
  const chatMembersSelect = jest.fn(() => ({ eq: chatMembersSelectEq }))
  const chatMembersInsert = jest.fn(() => Promise.resolve({ error: memberInsertError }))

  const chatRoomsInsertSingle = jest.fn(() =>
    Promise.resolve(
      roomInsertError ? { data: null, error: roomInsertError } : { data: { id: newRoomId }, error: null },
    ),
  )
  const chatRoomsInsertSelect = jest.fn(() => ({ single: chatRoomsInsertSingle }))
  const chatRoomsInsert = jest.fn(() => ({ select: chatRoomsInsertSelect }))
  const chatRoomsDeleteEq = jest.fn(() => Promise.resolve({ error: null }))
  const chatRoomsDelete = jest.fn(() => ({ eq: chatRoomsDeleteEq }))

  const from = jest.fn((table: string) => {
    if (table === 'chat_members') return { select: chatMembersSelect, insert: chatMembersInsert }
    if (table === 'chat_rooms') return { insert: chatRoomsInsert, delete: chatRoomsDelete }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from, chatMembersInsert, chatRoomsInsert, chatRoomsDelete, chatRoomsDeleteEq }
}

describe('getOrCreateBotRoom', () => {
  it('returns the existing bot room without creating a new one', async () => {
    const admin = makeAdminMock({ existingRoomId: 'existing-bot-room' })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { getOrCreateBotRoom: fn } = await import('@/app/chat/actions')

    const result = await fn()
    expect(result).toBe('existing-bot-room')
    expect(admin.chatRoomsInsert).not.toHaveBeenCalled()
  })

  it('creates a room and returns its id when the member insert succeeds', async () => {
    const admin = makeAdminMock({})
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { getOrCreateBotRoom: fn } = await import('@/app/chat/actions')

    const result = await fn()
    expect(result).toBe('new-room-1')
    expect(admin.chatRoomsDelete).not.toHaveBeenCalled()
  })

  // The regression: this exact scenario (bot user missing from public.users)
  // happened live and returned a "successful" room id with zero members.
  it('rolls back the room and returns an error when the member insert fails', async () => {
    const admin = makeAdminMock({
      memberInsertError: { message: 'insert or update on table "chat_members" violates foreign key constraint' },
    })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { getOrCreateBotRoom: fn } = await import('@/app/chat/actions')

    const result = await fn()
    expect(result).toEqual({
      error: 'insert or update on table "chat_members" violates foreign key constraint',
    })
    expect(admin.chatRoomsDeleteEq).toHaveBeenCalledWith('id', 'new-room-1')
  })
})

describe('getOrCreateDM', () => {
  it('rolls back the room and returns an error when the member insert fails', async () => {
    const admin = makeAdminMock({
      memberInsertError: { message: 'insert or update on table "chat_members" violates foreign key constraint' },
    })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { getOrCreateDM: fn } = await import('@/app/chat/actions')

    const result = await fn('other-user-id')
    expect(result).toEqual({
      error: 'insert or update on table "chat_members" violates foreign key constraint',
    })
    expect(admin.chatRoomsDeleteEq).toHaveBeenCalledWith('id', 'new-room-1')
  })
})
