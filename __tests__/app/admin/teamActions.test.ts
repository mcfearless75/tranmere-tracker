/**
 * @jest-environment node
 */
type WriteResult = { error: { message: string } | null }
type ReadResult<T> = { data: T[] | null; error: { message: string } | null }

const requireStaffActionMock = jest.fn()

// users.update(...).eq()/.in() AND teams.update(...).eq() — same shape, so
// one shared pair of mocks covers renameTeam/setTeamActive/setUserTeam alike.
const updateEqMock = jest.fn(async (): Promise<WriteResult> => ({ error: null }))
const updateInMock = jest.fn(async (): Promise<WriteResult> => ({ error: null }))
const updateMock = jest.fn(() => ({ eq: updateEqMock, in: updateInMock }))

// teams.insert(...)
const insertMock = jest.fn(async (): Promise<WriteResult> => ({ error: null }))

// createTeam's "what's the current highest sort_order" lookup:
// teams.select('sort_order').order(...).limit(1)
const maxOrderLimitMock = jest.fn(async (): Promise<ReadResult<{ sort_order: number }>> => ({ data: [], error: null }))
const maxOrderOrderMock = jest.fn(() => ({ limit: maxOrderLimitMock }))

// reorderTeams' "fetch what's already there" read: teams.select('id, name,
// is_active').in('id', ids)
const reorderInMock = jest.fn(
  async (): Promise<ReadResult<{ id: string; name: string; is_active: boolean }>> => ({ data: [], error: null })
)

// reorderTeams' single write: teams.upsert(rows)
const upsertMock = jest.fn(async (): Promise<WriteResult> => ({ error: null }))

const selectMock = jest.fn((columns: string) => {
  if (columns === 'sort_order') return { order: maxOrderOrderMock }
  return { in: reorderInMock }
})

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaffAction: () => requireStaffActionMock(),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  setUserTeam,
  setUsersTeam,
  createTeam,
  renameTeam,
  setTeamActive,
  reorderTeams,
} from '@/app/(admin)/admin/teams/teamActions'
import { TEAM_NAME_MAX } from '@/lib/teams/types'

function ctx() {
  return {
    role: 'coach',
    user: { id: 'me' },
    admin: {
      from: () => ({ update: updateMock, insert: insertMock, select: selectMock, upsert: upsertMock }),
    },
  }
}

describe('team server actions', () => {
  beforeEach(() => {
    requireStaffActionMock.mockReset()
    updateMock.mockClear()
    updateEqMock.mockClear().mockResolvedValue({ error: null })
    updateInMock.mockClear().mockResolvedValue({ error: null })
    insertMock.mockClear().mockResolvedValue({ error: null })
    selectMock.mockClear()
    maxOrderOrderMock.mockClear()
    maxOrderLimitMock.mockClear().mockResolvedValue({ data: [], error: null })
    reorderInMock.mockClear().mockResolvedValue({ data: [], error: null })
    upsertMock.mockClear().mockResolvedValue({ error: null })
    requireStaffActionMock.mockResolvedValue(ctx())
  })

  it('refuses a caller who is not staff, and writes nothing', async () => {
    requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
    const result = await setUserTeam('u1', 't1')
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error).toMatch(/permission/i)
    }
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('assigns a team to a user', async () => {
    await setUserTeam('u1', 't1')
    expect(updateMock).toHaveBeenCalledWith({ team_id: 't1' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'u1')
  })

  it('unassigns with null rather than an empty string', async () => {
    await setUserTeam('u1', null)
    expect(updateMock).toHaveBeenCalledWith({ team_id: null })
  })

  // Deliberately unlike updateUserYearGroup, which rejects non-students.
  // Joseph Barton is a coach who plays and is on the Prem sheet.
  it('allows a non-student to be put in a team', async () => {
    await setUserTeam('coach-1', 't1')
    expect(updateMock).toHaveBeenCalledWith({ team_id: 't1' })
  })

  it('assigns several users in one write', async () => {
    await setUsersTeam(['u1', 'u2'], 't1')
    expect(updateMock).toHaveBeenCalledWith({ team_id: 't1' })
    expect(updateInMock).toHaveBeenCalledWith('id', ['u1', 'u2'])
  })

  it('does nothing when given an empty user list', async () => {
    await setUsersTeam([], 't1')
    expect(updateMock).not.toHaveBeenCalled()
  })

  describe('createTeam sort_order', () => {
    // This is the requirement finding 7 exists for — a new team must land
    // AFTER every existing one. Asserting the literal payload passed to
    // insert() when no teams exist yet (sort_order 0) is what the old test
    // did, and it could never have caught the sort_order:0-always bug because
    // it just restated the implementation. Asserting "after the highest
    // existing sort_order" instead means reverting to a hardcoded 0 fails
    // this test whenever a team already occupies slot 0 — which real seeded
    // data (Prem at 0) always does.
    it('appends after the current highest sort_order rather than colliding with it', async () => {
      maxOrderLimitMock.mockResolvedValueOnce({ data: [{ sort_order: 2 }], error: null })
      await expect(createTeam('  Reserves  ')).resolves.toEqual({ ok: true })
      expect(insertMock).toHaveBeenCalledWith({ name: 'Reserves', sort_order: 3 })
    })

    it('starts at sort_order 0 only when no team exists yet', async () => {
      maxOrderLimitMock.mockResolvedValueOnce({ data: [], error: null })
      await expect(createTeam('Reserves')).resolves.toEqual({ ok: true })
      expect(insertMock).toHaveBeenCalledWith({ name: 'Reserves', sort_order: 0 })
    })

    it('surfaces a failed sort_order lookup rather than creating anyway', async () => {
      maxOrderLimitMock.mockResolvedValueOnce({ data: null, error: { message: 'db down' } })
      const result = await createTeam('Reserves')
      expect(result.ok).toBe(false)
      expect(insertMock).not.toHaveBeenCalled()
    })
  })

  // Returned, not thrown: a thrown Server Action error is redacted in
  // production, so the reason would never reach the coach.
  it('rejects an empty team name with a reason the client can show', async () => {
    const result = await createTeam('   ')
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error).toMatch(/empty/i)
    }
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects an over-long name rather than truncating it', async () => {
    const result = await createTeam('x'.repeat(TEAM_NAME_MAX + 1))
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error).toMatch(/longer/i)
    }
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('applies the same name rules to a rename', async () => {
    const result = await renameTeam('t1', '')
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error).toMatch(/empty/i)
    }
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('surfaces a database error rather than reporting success', async () => {
    updateEqMock.mockResolvedValueOnce({ error: { message: 'permission denied' } })
    const result = await setUserTeam('u1', 't1')
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error).toBe('permission denied')
    }
  })

  it('retires a team without touching its players', async () => {
    await setTeamActive('t1', false)
    expect(updateMock).toHaveBeenCalledWith({ is_active: false })
    expect(updateMock).not.toHaveBeenCalledWith({ team_id: null })
  })

  it('restores a retired team', async () => {
    await setTeamActive('t1', true)
    expect(updateMock).toHaveBeenCalledWith({ is_active: true })
    expect(updateEqMock).toHaveBeenCalledWith('id', 't1')
  })

  describe('reorderTeams', () => {
    it('refuses a caller who is not staff, and writes nothing', async () => {
      requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
      const result = await reorderTeams(['t1', 't2'])
      expect(result.ok).toBe(false)
      expect(upsertMock).not.toHaveBeenCalled()
    })

    it('does nothing for an empty id list', async () => {
      const result = await reorderTeams([])
      expect(result.ok).toBe(true)
      expect(upsertMock).not.toHaveBeenCalled()
    })

    // The requirement finding 8 exists for: one write for the whole new
    // order, not one UPDATE per team. A reintroduced per-row loop would
    // call the (shared) update() path N times instead of upsert() once, so
    // this fails against that regression, not just against "some write
    // happened".
    it('writes the whole new order in a single upsert, not one call per team', async () => {
      reorderInMock.mockResolvedValueOnce({
        data: [
          { id: 't1', name: 'Prem', is_active: true },
          { id: 't2', name: 'White', is_active: true },
          { id: 't3', name: 'Blue', is_active: true },
        ],
        error: null,
      })

      const result = await reorderTeams(['t2', 't1', 't3'])

      expect(result.ok).toBe(true)
      expect(upsertMock).toHaveBeenCalledTimes(1)
      expect(updateMock).not.toHaveBeenCalled()
      expect(upsertMock).toHaveBeenCalledWith([
        { id: 't2', sort_order: 0, name: 'White', is_active: true },
        { id: 't1', sort_order: 1, name: 'Prem', is_active: true },
        { id: 't3', sort_order: 2, name: 'Blue', is_active: true },
      ])
    })

    it('surfaces a failed read rather than upserting with incomplete data', async () => {
      reorderInMock.mockResolvedValueOnce({ data: null, error: { message: 'db down' } })
      const result = await reorderTeams(['t1'])
      expect(result.ok).toBe(false)
      expect(upsertMock).not.toHaveBeenCalled()
    })

    it('surfaces a failed write rather than reporting success', async () => {
      reorderInMock.mockResolvedValueOnce({ data: [{ id: 't1', name: 'Prem', is_active: true }], error: null })
      upsertMock.mockResolvedValueOnce({ error: { message: 'db down' } })
      const result = await reorderTeams(['t1'])
      expect(result.ok).toBe(false)
    })
  })
})
