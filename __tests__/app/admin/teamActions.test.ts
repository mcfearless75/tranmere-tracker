/**
 * @jest-environment node
 */

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

const updateEqMock = jest.fn(async () => ({ error: null }))
const insertMock = jest.fn(async () => ({ error: null }))
const updateMock = jest.fn(() => ({ eq: updateEqMock }))

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaffAction: jest.fn(),
}))

import { setUserTeam, setUsersTeam, createTeam, renameTeam, reorderTeams, setTeamActive } from '@/app/(admin)/admin/teams/teamActions'
import { requireStaffAction } from '@/lib/auth/requireRole'
import { ActionResult } from '@/lib/teams/types'

const requireStaffActionMock = requireStaffAction as jest.Mock

function ctx() {
  return {
    user: { id: 'me' },
    admin: {
      from: (table: string) => {
        if (table === 'teams') {
          return {
            update: updateMock,
            insert: insertMock,
          }
        }
        return {
          update: updateMock,
          select: () => ({ eq: () => ({ maybeSingle: jest.fn() }) }),
        }
      },
    },
  }
}

describe('teamActions are guarded and validated', () => {
  beforeEach(() => {
    requireStaffActionMock.mockReset()
    updateMock.mockClear()
    updateEqMock.mockClear()
    insertMock.mockClear()
    updateMock.mockReturnValue({ eq: updateEqMock })
  })

  describe('setUserTeam', () => {
    it('refuses a caller who is not staff, and writes nothing', async () => {
      requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
      await expect(setUserTeam('s1', 'team-id')).rejects.toThrow('Unauthorised')
      expect(updateMock).not.toHaveBeenCalled()
    })

    it('assigns a user to a team', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await setUserTeam('s1', 'team-prem')
      expect(result.ok).toBe(true)
      expect(updateEqMock).toHaveBeenCalledWith('id', 's1')
      expect(updateMock).toHaveBeenCalledWith({ team_id: 'team-prem' })
    })

    it('removes a user from a team with null', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await setUserTeam('s1', null)
      expect(result.ok).toBe(true)
      expect(updateMock).toHaveBeenCalledWith({ team_id: null })
    })
  })

  describe('setUsersTeam', () => {
    it('refuses a caller who is not staff, and writes nothing', async () => {
      requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
      await expect(setUsersTeam(['s1', 's2'], 'team-id')).rejects.toThrow('Unauthorised')
      expect(updateMock).not.toHaveBeenCalled()
    })

    it('assigns multiple users to a team', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await setUsersTeam(['s1', 's2'], 'team-prem')
      expect(result.ok).toBe(true)
      expect(updateEqMock).toHaveBeenCalledWith('id', ['s1', 's2'])
      expect(updateMock).toHaveBeenCalledWith({ team_id: 'team-prem' })
    })

    it('removes multiple users from a team with null', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await setUsersTeam(['s1', 's2'], null)
      expect(result.ok).toBe(true)
      expect(updateMock).toHaveBeenCalledWith({ team_id: null })
    })
  })

  describe('createTeam', () => {
    it('refuses a caller who is not staff, and writes nothing', async () => {
      requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
      await expect(createTeam('New Team')).rejects.toThrow('Unauthorised')
      expect(insertMock).not.toHaveBeenCalled()
    })

    it('creates a team with a valid name', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await createTeam('Prem Team')
      expect(result.ok).toBe(true)
      expect(insertMock).toHaveBeenCalledWith({ name: 'Prem Team', sort_order: 0 })
    })

    it('rejects an empty name, and writes nothing', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await createTeam('   ')
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/cannot be empty/i)
      expect(insertMock).not.toHaveBeenCalled()
    })

    it('rejects a name that is too long, and writes nothing', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await createTeam('a'.repeat(41))
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/cannot be longer than/i)
      expect(insertMock).not.toHaveBeenCalled()
    })
  })

  describe('renameTeam', () => {
    it('refuses a caller who is not staff, and writes nothing', async () => {
      requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
      await expect(renameTeam('team-id', 'New Name')).rejects.toThrow('Unauthorised')
      expect(updateMock).not.toHaveBeenCalled()
    })

    it('renames a team with a valid name', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await renameTeam('team-prem', 'Premier Team')
      expect(result.ok).toBe(true)
      expect(updateMock).toHaveBeenCalledWith({ name: 'Premier Team' })
      expect(updateEqMock).toHaveBeenCalledWith('id', 'team-prem')
    })

    it('rejects an empty name, and writes nothing', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await renameTeam('team-prem', '   ')
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/cannot be empty/i)
      expect(updateMock).not.toHaveBeenCalledWith({ name: '   ' })
    })

    it('rejects a name that is too long, and writes nothing', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await renameTeam('team-prem', 'a'.repeat(41))
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/cannot be longer than/i)
      expect(updateMock).not.toHaveBeenCalledWith({ name: 'a'.repeat(41) })
    })
  })

  describe('reorderTeams', () => {
    it('refuses a caller who is not staff, and writes nothing', async () => {
      requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
      await expect(reorderTeams(['team-1', 'team-2'])).rejects.toThrow('Unauthorised')
      expect(updateMock).not.toHaveBeenCalled()
    })

    it('reorders teams', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await reorderTeams(['team-prem', 'team-white', 'team-blue'])
      expect(result.ok).toBe(true)
      expect(updateMock).toHaveBeenCalledTimes(3)
      expect(updateMock).toHaveBeenNthCalledWith(1, { sort_order: 0 })
      expect(updateMock).toHaveBeenNthCalledWith(2, { sort_order: 1 })
      expect(updateMock).toHaveBeenNthCalledWith(3, { sort_order: 2 })
    })
  })

  describe('setTeamActive', () => {
    it('refuses a caller who is not staff, and writes nothing', async () => {
      requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
      await expect(setTeamActive('team-id', false)).rejects.toThrow('Unauthorised')
      expect(updateMock).not.toHaveBeenCalled()
    })

    it('deactivates a team', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await setTeamActive('team-prem', false)
      expect(result.ok).toBe(true)
      expect(updateMock).toHaveBeenCalledWith({ is_active: false })
      expect(updateEqMock).toHaveBeenCalledWith('id', 'team-prem')
    })

    it('reactivates a team', async () => {
      requireStaffActionMock.mockResolvedValue(ctx())
      const result: ActionResult = await setTeamActive('team-blue', true)
      expect(result.ok).toBe(true)
      expect(updateMock).toHaveBeenCalledWith({ is_active: true })
      expect(updateEqMock).toHaveBeenCalledWith('id', 'team-blue')
    })
  })
})
