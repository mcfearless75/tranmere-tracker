/**
 * @jest-environment node
 */
const requireStaffActionMock = jest.fn()
const eqMock = jest.fn(async () => ({ error: null }))
const updateMock = jest.fn(() => ({ eq: eqMock }))
const maybeSingleMock = jest.fn(async () => ({ data: { role: 'student' } }))

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaffAction: () => requireStaffActionMock(),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  updateUserRole,
  updateUserYearGroup,
  updateUserName,
} from '@/app/(admin)/admin/users/userActions'
import { USER_NAME_MAX } from '@/lib/users/types'

function ctx(role: string) {
  return {
    role,
    user: { id: 'me' },
    admin: {
      from: () => ({
        update: updateMock,
        select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      }),
    },
  }
}

describe('users server actions are guarded', () => {
  beforeEach(() => {
    requireStaffActionMock.mockReset()
    updateMock.mockClear()
    maybeSingleMock.mockClear()
    maybeSingleMock.mockResolvedValue({ data: { role: 'student' } } as any)
  })

  it('refuses a caller who is not staff, and writes nothing', async () => {
    requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
    await expect(updateUserYearGroup('s1', 2)).rejects.toThrow('Unauthorised')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('stops a coach granting someone an admin role', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('coach'))
    await expect(updateUserRole('s1', 'admin')).rejects.toThrow(/admin/i)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('lets an admin grant a staff role', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await updateUserRole('s1', 'coach')
    expect(updateMock).toHaveBeenCalledWith({ role: 'coach' })
  })

  it('rejects a role that is not a real role', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserRole('s1', 'superuser')).rejects.toThrow('Invalid role')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rejects a year group outside 1 and 2', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserYearGroup('s1', 3)).rejects.toThrow('Invalid year group')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('sets the year group for a student', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('coach'))
    await updateUserYearGroup('s1', 2)
    expect(updateMock).toHaveBeenCalledWith({ year_group: 2 })
  })

  it('refuses to set a year group on a staff account', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    maybeSingleMock.mockResolvedValue({ data: { role: 'coach' } } as any)
    await expect(updateUserYearGroup('c1', 2)).rejects.toThrow(/students only/i)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('refuses a rename from a caller who is not staff, and writes nothing', async () => {
    requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
    await expect(updateUserName('s1', 'Javan Moussa')).rejects.toThrow('Unauthorised')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('renames a user, trimming surrounding whitespace', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('coach'))
    await updateUserName('s1', '  Javan Moussa  ')
    expect(updateMock).toHaveBeenCalledWith({ name: 'Javan Moussa' })
  })

  it('rejects an empty or whitespace-only name', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserName('s1', '   ')).rejects.toThrow(/empty/i)
    expect(updateMock).not.toHaveBeenCalled()
  })

  // Rejected, never truncated — a silently shortened name is the failure mode
  // that bit the chat/folder name fields.
  it('rejects an over-long name rather than truncating it', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserName('s1', 'x'.repeat(USER_NAME_MAX + 1))).rejects.toThrow(/longer than/i)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('accepts a name exactly at the limit', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await updateUserName('s1', 'x'.repeat(USER_NAME_MAX))
    expect(updateMock).toHaveBeenCalledWith({ name: 'x'.repeat(USER_NAME_MAX) })
  })
})
