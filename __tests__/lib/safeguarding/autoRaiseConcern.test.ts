/**
 * @jest-environment node
 */
const notifyUsersMock = jest.fn(() => Promise.resolve())
jest.mock('@/lib/notifications/notifyStaff', () => ({
  notifyUsers: (...args: unknown[]) => notifyUsersMock(...args),
}))

import { autoRaiseConcern } from '@/lib/safeguarding/autoRaiseConcern'

const BASE_PARAMS = {
  studentId: 'student-1',
  category: 'wellbeing' as const,
  severity: 'high' as const,
  description: 'test description',
  notifyTitle: 'Test title',
  notifyBody: 'Test body',
  notifyUrl: '/chat/room-1',
}

/** Minimal admin-client double for the two tables autoRaiseConcern touches. */
function makeAdminMock(opts: {
  alreadyRaisedToday?: boolean
  insertError?: { code: string } | null
  dslIds?: string[]
} = {}) {
  const { alreadyRaisedToday = false, insertError = null, dslIds = ['dsl-1'] } = opts

  // Upfront dedup check: .select('id').eq().eq().eq().is().limit().maybeSingle()
  const checkMaybeSingle = jest.fn(() =>
    Promise.resolve({ data: alreadyRaisedToday ? { id: 'existing-concern' } : null })
  )
  const checkLimit = jest.fn(() => ({ maybeSingle: checkMaybeSingle }))
  const checkIs = jest.fn(() => ({ limit: checkLimit }))
  const checkEq3 = jest.fn(() => ({ is: checkIs }))
  const checkEq2 = jest.fn(() => ({ eq: checkEq3 }))
  const checkEq1 = jest.fn(() => ({ eq: checkEq2 }))
  const concernsSelect = jest.fn(() => ({ eq: checkEq1 }))

  // Insert: .insert({...}).select('id').single()
  const insertSingle = jest.fn(() =>
    Promise.resolve(
      insertError ? { data: null, error: insertError } : { data: { id: 'new-concern' }, error: null }
    )
  )
  const insertSelect = jest.fn(() => ({ single: insertSingle }))
  const concernsInsert = jest.fn(() => ({ select: insertSelect }))

  // DSL lookup: .select('id').eq('role', 'admin')
  const usersEq = jest.fn(() => Promise.resolve({ data: dslIds.map(id => ({ id })) }))
  const usersSelect = jest.fn(() => ({ eq: usersEq }))

  const from = jest.fn((table: string) => {
    if (table === 'safeguarding_concerns') return { select: concernsSelect, insert: concernsInsert }
    if (table === 'users') return { select: usersSelect }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from }
}

beforeEach(() => {
  notifyUsersMock.mockClear()
})

describe('autoRaiseConcern', () => {
  it('inserts a concern and notifies the DSL when none exists yet today', async () => {
    const admin = makeAdminMock()
    const result = await autoRaiseConcern(admin as any, BASE_PARAMS)
    expect(result).toEqual({ raised: true })
    expect(notifyUsersMock).toHaveBeenCalledTimes(1)
    expect(notifyUsersMock).toHaveBeenCalledWith(
      admin,
      ['dsl-1'],
      expect.objectContaining({ title: BASE_PARAMS.notifyTitle, url: BASE_PARAMS.notifyUrl })
    )
  })

  it('skips and does not notify when a concern already exists today', async () => {
    const admin = makeAdminMock({ alreadyRaisedToday: true })
    const result = await autoRaiseConcern(admin as any, BASE_PARAMS)
    expect(result).toEqual({ raised: false })
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })

  it('treats a unique-violation (23505) insert error as a race loss, not a failure', async () => {
    const admin = makeAdminMock({ insertError: { code: '23505' } })
    const result = await autoRaiseConcern(admin as any, BASE_PARAMS)
    expect(result).toEqual({ raised: false })
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })

  it('logs and returns raised:false on an unexpected insert error, without throwing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const admin = makeAdminMock({ insertError: { code: 'XXXXX' } })
    const result = await autoRaiseConcern(admin as any, BASE_PARAMS)
    expect(result).toEqual({ raised: false })
    expect(notifyUsersMock).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('does not notify when there are no admin users, but still reports raised:true', async () => {
    const admin = makeAdminMock({ dslIds: [] })
    const result = await autoRaiseConcern(admin as any, BASE_PARAMS)
    expect(result).toEqual({ raised: true })
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })
})
