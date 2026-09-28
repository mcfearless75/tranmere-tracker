/**
 * @jest-environment node
 */
const requireStaffActionMock = jest.fn()
jest.mock('@/lib/auth/requireRole', () => ({ requireStaffAction: () => requireStaffActionMock() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { saveSquadNumbers } from '@/app/(admin)/admin/match-events/[id]/squadNumberActions'

const upsert = jest.fn()
const eq = jest.fn()
const admin = { from: jest.fn(() => ({ select: () => ({ eq }), upsert })) }

beforeEach(() => {
  jest.clearAllMocks()
  requireStaffActionMock.mockResolvedValue({ admin })
  eq.mockResolvedValue({ data: [{ id: 's1', player_id: 'caleb' }, { id: 's2', player_id: 'blake' }], error: null })
  upsert.mockResolvedValue({ error: null })
})

it('refuses a caller who is not staff, as a result rather than a throw', async () => {
  requireStaffActionMock.mockRejectedValue(new Error('forbidden'))
  const result = await saveSquadNumbers('m1', [])
  expect(result.ok).toBe(false)
  expect(upsert).not.toHaveBeenCalled()
})

it('saves the whole squad in ONE upsert so a swap is a single transaction', async () => {
  const result = await saveSquadNumbers('m1', [
    { squadId: 's1', shirt: 13, gps: 13 },
    { squadId: 's2', shirt: 1, gps: 1 },
  ])
  expect(result).toEqual({ ok: true })
  expect(upsert).toHaveBeenCalledTimes(1)
  expect(upsert).toHaveBeenCalledWith([
    { id: 's1', match_id: 'm1', player_id: 'caleb', shirt_number: 13, gps_number: 13 },
    { id: 's2', match_id: 'm1', player_id: 'blake', shirt_number: 1, gps_number: 1 },
  ], { onConflict: 'id' })
})

it.each([0, 100, 2.5, NaN])('rejects the number %p', async (n) => {
  const result = await saveSquadNumbers('m1', [{ squadId: 's1', shirt: n, gps: null }])
  expect(result.ok).toBe(false)
  expect(upsert).not.toHaveBeenCalled()
})

it('rejects two players on the same pod', async () => {
  const result = await saveSquadNumbers('m1', [
    { squadId: 's1', shirt: 1, gps: 4 },
    { squadId: 's2', shirt: 2, gps: 4 },
  ])
  expect(result).toEqual({ ok: false, error: 'Two players have the same GPS pod' })
  expect(upsert).not.toHaveBeenCalled()
})

it('rejects a squad row that does not belong to this match', async () => {
  const result = await saveSquadNumbers('m1', [{ squadId: 's-other-match', shirt: 1, gps: 1 }])
  expect(result.ok).toBe(false)
  expect(upsert).not.toHaveBeenCalled()
})

it('explains a unique-constraint clash in plain words', async () => {
  upsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } })
  const result = await saveSquadNumbers('m1', [{ squadId: 's1', shirt: 1, gps: 1 }])
  expect(result).toEqual({ ok: false, error: 'That number is already used by another player in this match' })
})
