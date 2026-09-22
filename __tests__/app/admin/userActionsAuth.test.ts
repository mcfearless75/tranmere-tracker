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
  updateUserCourse,
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
    eqMock.mockClear()
    eqMock.mockResolvedValue({ error: null } as any)
    maybeSingleMock.mockClear()
    maybeSingleMock.mockResolvedValue({ data: { role: 'student' } } as any)
  })

  // requireStaffAction throws, but the action converts that to a result: a
  // thrown reason is redacted in production, so an expired session showed the
  // same "Not saved — try again" as everything else with nothing to act on.
  it('refuses a caller who is not staff, and writes nothing', async () => {
    requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
    await expect(updateUserYearGroup('s1', 2)).resolves.toEqual({
      ok: false,
      error: 'You do not have permission to make that change — try signing in again',
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('tells an unauthorised caller something they can act on', async () => {
    requireStaffActionMock.mockRejectedValue(new Error('Forbidden'))
    const res = await updateUserRole('s1', 'student')
    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toMatch(/signing in again/)
  })

  it('stops a coach granting someone an admin role', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('coach'))
    await expect(updateUserRole('s1', 'admin')).resolves.toEqual({
      ok: false, error: 'Only an admin can grant staff roles',
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('lets an admin grant a staff role', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserRole('s1', 'coach')).resolves.toEqual({ ok: true })
    expect(updateMock).toHaveBeenCalledWith({ role: 'coach' })
  })

  it('rejects a role that is not a real role', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserRole('s1', 'superuser')).resolves.toEqual({
      ok: false, error: 'Invalid role',
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rejects a year group outside 1 and 2', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserYearGroup('s1', 3)).resolves.toEqual({
      ok: false, error: 'Invalid year group',
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('sets the year group for a student', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('coach'))
    await expect(updateUserYearGroup('s1', 2)).resolves.toEqual({ ok: true })
    expect(updateMock).toHaveBeenCalledWith({ year_group: 2 })
  })

  it('refuses to set a year group on a staff account', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    maybeSingleMock.mockResolvedValue({ data: { role: 'coach' } } as any)
    await expect(updateUserYearGroup('c1', 2)).resolves.toEqual({
      ok: false, error: 'Year group applies to students only',
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('refuses a rename from a caller who is not staff, and writes nothing', async () => {
    requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
    await expect(updateUserName('s1', 'Javan Moussa')).resolves.toMatchObject({ ok: false })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('renames a user, trimming surrounding whitespace', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('coach'))
    await expect(updateUserName('s1', '  Javan Moussa  ')).resolves.toEqual({ ok: true })
    expect(updateMock).toHaveBeenCalledWith({ name: 'Javan Moussa' })
  })

  it('rejects an empty or whitespace-only name', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserName('s1', '   ')).resolves.toEqual({
      ok: false, error: 'Name cannot be empty',
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  // Rejected, never truncated — a silently shortened name is the failure mode
  // that bit the chat/folder name fields.
  it('rejects an over-long name rather than truncating it', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserName('s1', 'x'.repeat(USER_NAME_MAX + 1))).resolves.toEqual({
      ok: false, error: `Name cannot be longer than ${USER_NAME_MAX} characters`,
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  /**
   * These four updates used to drop the write error entirely. A Server Action
   * plus revalidatePath mostly self-reports — the refetched value simply
   * hasn't changed — but "it didn't change" is not the same as being told why,
   * and the selects in UserFields are optimistic, so they kept showing the
   * value the user had picked.
   */
  it('reports a failed role write instead of returning ok', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    eqMock.mockResolvedValue({ error: { message: 'permission denied for table users' } } as any)
    await expect(updateUserRole('s1', 'student')).resolves.toEqual({
      ok: false, error: 'permission denied for table users',
    })
  })

  it('reports a failed year group write instead of returning ok', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    eqMock.mockResolvedValue({ error: { message: 'sync_year_group_chat failed' } } as any)
    await expect(updateUserYearGroup('s1', 2)).resolves.toEqual({
      ok: false, error: 'sync_year_group_chat failed',
    })
  })

  it('reports a failed rename instead of returning ok', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    eqMock.mockResolvedValue({ error: { message: 'value too long' } } as any)
    await expect(updateUserName('s1', 'Javan Moussa')).resolves.toEqual({
      ok: false, error: 'value too long',
    })
  })

  it('reports a failed course write instead of returning ok', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    eqMock.mockResolvedValue({ error: { message: 'course_id fkey violation' } } as any)
    await expect(updateUserCourse('s1', 'c-nope')).resolves.toEqual({
      ok: false, error: 'course_id fkey violation',
    })
  })

  it('clears the course when given an empty id', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserCourse('s1', '')).resolves.toEqual({ ok: true })
    expect(updateMock).toHaveBeenCalledWith({ course_id: null })
  })

  // A failed role lookup also leaves target null; reporting that as "students
  // only" would send staff looking at the account rather than the request.
  it('separates a failed lookup from a genuine non-student', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'timeout' } } as any)
    await expect(updateUserYearGroup('s1', 2)).resolves.toEqual({ ok: false, error: 'timeout' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('reports a missing user rather than blaming their role', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    maybeSingleMock.mockResolvedValue({ data: null, error: null } as any)
    await expect(updateUserYearGroup('gone', 2)).resolves.toEqual({
      ok: false, error: 'That user no longer exists',
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('accepts a name exactly at the limit', async () => {
    requireStaffActionMock.mockResolvedValue(ctx('admin'))
    await expect(updateUserName('s1', 'x'.repeat(USER_NAME_MAX))).resolves.toEqual({ ok: true })
    expect(updateMock).toHaveBeenCalledWith({ name: 'x'.repeat(USER_NAME_MAX) })
  })
})
