/**
 * @jest-environment node
 */
const getUserMock = jest.fn()
const getUnreadSummaryMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: getUserMock } }),
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
jest.mock('@/lib/chat/unread', () => ({
  getUnreadSummary: (...args: unknown[]) => getUnreadSummaryMock(...args),
}))

import { GET } from '@/app/api/chat/unread/route'

const ROOM = '11111111-1111-4111-8111-111111111111'
const req = (qs = '') => new Request(`http://localhost/api/chat/unread${qs}`)

beforeEach(() => jest.clearAllMocks())

describe('GET /api/chat/unread', () => {
  it('401s when signed out', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect((await GET(req())).status).toBe(401)
    expect(getUnreadSummaryMock).not.toHaveBeenCalled()
  })

  it('returns the caller\'s own summary, passing a valid viewing room through', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getUnreadSummaryMock.mockResolvedValue({ total: 4, latest: null })
    const res = await GET(req(`?viewing=${ROOM}`))
    expect(await res.json()).toEqual({ ok: true, total: 4, latest: null })
    expect(getUnreadSummaryMock).toHaveBeenCalledWith(expect.anything(), 'u1', ROOM)
  })

  it('ignores a malformed viewing param', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getUnreadSummaryMock.mockResolvedValue({ total: 0, latest: null })
    await GET(req('?viewing=not-a-uuid'))
    expect(getUnreadSummaryMock).toHaveBeenCalledWith(expect.anything(), 'u1', null)
  })

  it('500s with {ok:false} when the lookup throws', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getUnreadSummaryMock.mockRejectedValue(new Error('db'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(req())
    expect(res.status).toBe(500)
    expect((await res.json()).ok).toBe(false)
  })
})
