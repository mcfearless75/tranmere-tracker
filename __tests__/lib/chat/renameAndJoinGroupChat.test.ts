/**
 * @jest-environment node
 *
 * Coverage for two group-chat gaps reported live:
 * 1. No way to rename a group chat once created.
 * 2. The admin "Chat Group Membership" page (/admin/chat-groups) lists
 *    every custom group regardless of the viewing staff member's own
 *    membership (by design — see 056_chat_member_only_visibility.sql), but
 *    there was no way to actually open one you'd never been added to.
 *    joinGroupChat() closes that gap: it's the "Open chat" action's
 *    idempotent self-add-then-navigate step.
 */
const STAFF_USER_ID = 'staff-1'

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: STAFF_USER_ID } } }) },
  }),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

function makeAdminMock(opts: {
  role?: string
  roomKind?: string
  syncYearGroup?: number | null
  updateError?: { message: string } | null
  upsertError?: { message: string } | null
}) {
  const {
    role = 'coach',
    roomKind = 'custom',
    syncYearGroup = null,
    updateError = null,
    upsertError = null,
  } = opts

  const roleMaybeSingle = jest.fn(() => Promise.resolve({ data: { role } }))
  const roleEq = jest.fn(() => ({ maybeSingle: roleMaybeSingle }))
  const roleSelect = jest.fn(() => ({ eq: roleEq }))

  const roomStateMaybeSingle = jest.fn(() =>
    Promise.resolve({ data: { kind: roomKind, sync_year_group: syncYearGroup } }),
  )
  const roomStateEq = jest.fn(() => ({ maybeSingle: roomStateMaybeSingle }))
  const roomStateSelect = jest.fn(() => ({ eq: roomStateEq }))

  const updateEq = jest.fn(() => Promise.resolve({ error: updateError }))
  const update = jest.fn(() => ({ eq: updateEq }))

  const upsert = jest.fn(() => Promise.resolve({ error: upsertError }))

  const from = jest.fn((table: string) => {
    if (table === 'users') return { select: roleSelect }
    if (table === 'chat_rooms') return { select: roomStateSelect, update }
    if (table === 'chat_members') return { upsert }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from, update, updateEq, upsert }
}

describe('renameGroupChat', () => {
  it('renames a custom group when the caller is staff', async () => {
    const admin = makeAdminMock({})
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { renameGroupChat } = await import('@/app/chat/actions')

    const result = await renameGroupChat('room-1', '  New Name  ')

    expect(result).toEqual({ ok: true })
    expect(admin.update).toHaveBeenCalledWith({ name: 'New Name' })
    expect(admin.updateEq).toHaveBeenCalledWith('id', 'room-1')
  })

  it('rejects a non-staff caller', async () => {
    const admin = makeAdminMock({ role: 'student' })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { renameGroupChat } = await import('@/app/chat/actions')

    const result = await renameGroupChat('room-1', 'New Name')

    expect(result).toEqual({ ok: false, error: 'Staff only' })
    expect(admin.update).not.toHaveBeenCalled()
  })

  it('rejects a room that is not a custom group', async () => {
    const admin = makeAdminMock({ roomKind: 'dm' })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { renameGroupChat } = await import('@/app/chat/actions')

    const result = await renameGroupChat('room-1', 'New Name')

    expect(result).toEqual({ ok: false, error: 'Not a group chat' })
    expect(admin.update).not.toHaveBeenCalled()
  })

  it('rejects a name over 60 characters', async () => {
    const admin = makeAdminMock({})
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { renameGroupChat } = await import('@/app/chat/actions')

    const result = await renameGroupChat('room-1', 'A'.repeat(61))

    expect(result).toEqual({ ok: false, error: 'Group name must be 60 characters or fewer' })
    expect(admin.update).not.toHaveBeenCalled()
  })

  it('rejects an empty/whitespace-only name', async () => {
    const admin = makeAdminMock({})
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { renameGroupChat } = await import('@/app/chat/actions')

    const result = await renameGroupChat('room-1', '   ')

    expect(result).toEqual({ ok: false, error: 'Group needs a name' })
    expect(admin.update).not.toHaveBeenCalled()
  })
})

describe('joinGroupChat', () => {
  it('upserts the caller into the room as a member', async () => {
    const admin = makeAdminMock({})
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { joinGroupChat } = await import('@/app/chat/actions')

    const result = await joinGroupChat('room-1')

    expect(result).toEqual({ ok: true })
    expect(admin.upsert).toHaveBeenCalledWith(
      { room_id: 'room-1', user_id: STAFF_USER_ID, role: 'member' },
      { onConflict: 'room_id,user_id', ignoreDuplicates: true },
    )
  })

  it('rejects a non-staff caller', async () => {
    const admin = makeAdminMock({ role: 'student' })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { joinGroupChat } = await import('@/app/chat/actions')

    const result = await joinGroupChat('room-1')

    expect(result).toEqual({ ok: false, error: 'Staff only' })
    expect(admin.upsert).not.toHaveBeenCalled()
  })

  it('rejects a room that is not a custom group', async () => {
    const admin = makeAdminMock({ roomKind: 'broadcast' })
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { joinGroupChat } = await import('@/app/chat/actions')

    const result = await joinGroupChat('room-1')

    expect(result).toEqual({ ok: false, error: 'Not a group chat' })
    expect(admin.upsert).not.toHaveBeenCalled()
  })
})
