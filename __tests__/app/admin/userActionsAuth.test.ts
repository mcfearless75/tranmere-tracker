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

import { updateUserRole, updateUserYearGroup } from '@/app/(admin)/admin/users/userActions'

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
})
