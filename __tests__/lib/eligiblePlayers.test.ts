/**
 * @jest-environment node
 */
import { eligiblePlayers, ELIGIBLE_PLAYER_FILTER } from '@/lib/teams/players'

function fakeSupabase() {
  const calls: Record<string, unknown[]> = {}
  const builder: Record<string, (...a: unknown[]) => unknown> = {}
  for (const m of ['select', 'eq', 'or', 'order']) {
    builder[m] = (...args: unknown[]) => {
      calls[m] = args
      return builder
    }
  }
  return { client: { from: (t: string) => { calls.from = [t]; return builder } }, calls }
}

describe('eligiblePlayers', () => {
  it('reads from users, only active rows, ordered by name', () => {
    const { client, calls } = fakeSupabase()
    eligiblePlayers(client as never, 'id, name')
    expect(calls.from).toEqual(['users'])
    expect(calls.select).toEqual(['id, name'])
    expect(calls.eq).toEqual(['is_active', true])
    expect(calls.order).toEqual(['name'])
  })

  it('includes students and anyone with a team, so a coach who plays is pickable', () => {
    const { client, calls } = fakeSupabase()
    eligiblePlayers(client as never, 'id')
    expect(calls.or).toEqual([ELIGIBLE_PLAYER_FILTER])
    expect(ELIGIBLE_PLAYER_FILTER).toBe('role.eq.student,team_id.not.is.null')
  })
})
