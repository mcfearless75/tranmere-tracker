/**
 * @jest-environment node
 */
const getUserMock = jest.fn()
const getStudentStreakMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: getUserMock } }),
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
jest.mock('@/lib/dates', () => ({ londonDateISO: () => '2026-09-28' }))
jest.mock('@/lib/attendance/streak', () => ({
  getStudentStreak: (...args: unknown[]) => getStudentStreakMock(...args),
}))

import { GET } from '@/app/api/attendance/streak/route'

beforeEach(() => jest.clearAllMocks())

describe('GET /api/attendance/streak', () => {
  it('401s when signed out', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
    expect(getStudentStreakMock).not.toHaveBeenCalled()
  })

  it("returns only the caller's own streak", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'stu-1' } } })
    getStudentStreakMock.mockResolvedValue({ current: 3, best: 5, todayDone: false })
    const res = await GET()
    expect(await res.json()).toEqual({ ok: true, streak: { current: 3, best: 5, todayDone: false } })
    expect(getStudentStreakMock).toHaveBeenCalledWith(expect.anything(), 'stu-1', '2026-09-28')
  })

  it('500s with {ok:false} when the lookup throws', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'stu-1' } } })
    getStudentStreakMock.mockRejectedValue(new Error('db down'))
    const res = await GET()
    expect(res.status).toBe(500)
    expect((await res.json()).ok).toBe(false)
  })
})
