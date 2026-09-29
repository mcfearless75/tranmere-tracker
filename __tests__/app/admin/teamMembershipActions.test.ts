/**
 * @jest-environment node
 */
const requireStaffActionMock = jest.fn()
jest.mock('@/lib/auth/requireRole', () => ({ requireStaffAction: () => requireStaffActionMock() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { addUsersToTeam, removeUserFromTeam, createTeamChat } from '@/app/(admin)/admin/teams/teamActions'

type Call = { table: string; op: string; args: unknown[] }
let calls: Call[]
let responses: Record<string, unknown>

/** Chainable fake: every method records itself and returns the chain; awaiting resolves responses[table.op]. */
function fakeAdmin() {
  return {
    from(table: string) {
      let op = ''
      const chain: Record<string, unknown> = {}
      const record = (name: string) => (...args: unknown[]) => {
        if (['select', 'insert', 'upsert', 'delete', 'update'].includes(name) && !op) op = name
        calls.push({ table, op: name, args })
        return chain
      }
      for (const m of ['select', 'insert', 'upsert', 'delete', 'update', 'eq', 'in', 'not']) chain[m] = record(m)
      const resolve = () => Promise.resolve(responses[`${table}.${op}`] ?? { data: null, error: null })
      chain.maybeSingle = () => resolve()
      chain.single = () => resolve()
      chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => resolve().then(res, rej)
      return chain
    },
  }
}

beforeEach(() => {
  calls = []
  responses = {}
  requireStaffActionMock.mockReset().mockResolvedValue({ role: 'coach', user: { id: 'me' }, admin: fakeAdmin() })
})

it('refuses non-staff without touching the database', async () => {
  requireStaffActionMock.mockRejectedValue(new Error('Forbidden'))
  expect((await addUsersToTeam(['p1'], 't1')).ok).toBe(false)
  expect(calls).toHaveLength(0)
})

it('addUsersToTeam upserts memberships without moving anyone', async () => {
  expect(await addUsersToTeam(['p1', 'p2'], 't1')).toEqual({ ok: true })
  const upsert = calls.find(c => c.table === 'team_members' && c.op === 'upsert')!
  expect(upsert.args[0]).toEqual([{ team_id: 't1', user_id: 'p1' }, { team_id: 't1', user_id: 'p2' }])
  expect(calls.some(c => c.table === 'users' && c.op === 'update')).toBe(false)
})

it('removeUserFromTeam deletes only that one membership', async () => {
  expect(await removeUserFromTeam('p1', 't1')).toEqual({ ok: true })
  expect(calls.filter(c => c.table === 'team_members').map(c => [c.op, ...c.args])).toEqual([
    ['delete'], ['eq', 'team_id', 't1'], ['eq', 'user_id', 'p1'],
  ])
})

it('createTeamChat returns the existing chat instead of making a second', async () => {
  responses['chat_rooms.select'] = { data: { id: 'existing' }, error: null }
  expect(await createTeamChat('t1')).toEqual({ ok: true, roomId: 'existing' })
  expect(calls.some(c => c.op === 'insert')).toBe(false)
})

it('createTeamChat seeds team players and staff, once each', async () => {
  responses['teams.select'] = { data: { name: 'Prem' }, error: null }
  responses['chat_rooms.insert'] = { data: { id: 'new-room' }, error: null }
  responses['team_members.select'] = { data: [{ user_id: 'p1' }, { user_id: 'coach-1' }], error: null }
  responses['users.select'] = { data: [{ id: 'coach-1' }, { id: 'coach-2' }], error: null }

  expect(await createTeamChat('t1')).toEqual({ ok: true, roomId: 'new-room' })
  const insert = calls.find(c => c.table === 'chat_rooms' && c.op === 'insert')!
  expect(insert.args[0]).toEqual({ kind: 'custom', name: 'Prem Squad', sync_team_id: 't1', created_by: null })
  const seed = calls.find(c => c.table === 'chat_members' && c.op === 'upsert')!
  expect((seed.args[0] as { user_id: string }[]).map(r => r.user_id).sort()).toEqual(['coach-1', 'coach-2', 'p1'])
})
