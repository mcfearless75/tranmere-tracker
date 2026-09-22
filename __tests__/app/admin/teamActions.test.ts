/**
 * @jest-environment node
 */
type WriteResult = { error: { message: string } | null }

const requireStaffActionMock = jest.fn()
const updateEqMock = jest.fn(async (): Promise<WriteResult> => ({ error: null }))
const updateInMock = jest.fn(async (): Promise<WriteResult> => ({ error: null }))
const updateMock = jest.fn(() => ({ eq: updateEqMock, in: updateInMock }))
const insertMock = jest.fn(async (): Promise<WriteResult> => ({ error: null }))

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
} from '@/app/(admin)/admin/teams/teamActions'
import { TEAM_NAME_MAX } from '@/lib/teams/types'

function ctx() {
  return {
    role: 'coach',
    user: { id: 'me' },
    admin: { from: () => ({ update: updateMock, insert: insertMock }) },
  }
}

describe('team server actions', () => {
  beforeEach(() => {
    requireStaffActionMock.mockReset()
    updateMock.mockClear()
    insertMock.mockClear()
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

  it('trims a new team name', async () => {
    await expect(createTeam('  Reserves  ')).resolves.toEqual({ ok: true })
    expect(insertMock).toHaveBeenCalledWith({ name: 'Reserves', sort_order: 0 })
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
})
