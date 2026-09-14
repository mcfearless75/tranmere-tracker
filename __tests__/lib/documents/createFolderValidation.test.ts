/**
 * @jest-environment node
 *
 * Regression coverage for the same "whole message typed into the name
 * field" bug class fixed across the app on 2026-09-14 (broadcast channels,
 * group chats, and this app-wide sweep). CreateFolderButton's name input
 * had the identical shape — single field, Enter-to-submit — so it gets the
 * same server-side floor.
 */
const STAFF_USER_ID = 'staff-1'

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: STAFF_USER_ID } } }) },
  }),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

function makeAdminMock() {
  const roleMaybeSingle = jest.fn(() => Promise.resolve({ data: { role: 'coach' } }))
  const roleEq = jest.fn(() => ({ maybeSingle: roleMaybeSingle }))
  const roleSelect = jest.fn(() => ({ eq: roleEq }))

  const folderInsertSingle = jest.fn(() => Promise.resolve({ data: { id: 'folder-1' }, error: null }))
  const folderInsertSelect = jest.fn(() => ({ single: folderInsertSingle }))
  const folderInsert = jest.fn(() => ({ select: folderInsertSelect }))

  const from = jest.fn((table: string) => {
    if (table === 'users') return { select: roleSelect }
    if (table === 'document_folders') return { insert: folderInsert }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from, folderInsert }
}

describe('createFolder — name length validation', () => {
  it('rejects a name over 60 characters and never creates the folder', async () => {
    const admin = makeAdminMock()
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { createFolder } = await import('@/app/documents/actions')

    const result = await createFolder('A'.repeat(61))

    expect(result).toEqual({ error: 'Folder name must be 60 characters or fewer' })
    expect(admin.folderInsert).not.toHaveBeenCalled()
  })

  it('accepts a name of exactly 60 characters', async () => {
    const admin = makeAdminMock()
    jest.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
    jest.resetModules()
    const { createFolder } = await import('@/app/documents/actions')

    const result = await createFolder('A'.repeat(60))

    expect(result).toBe('folder-1')
    expect(admin.folderInsert).toHaveBeenCalledTimes(1)
  })
})
