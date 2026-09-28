/**
 * @jest-environment node
 *
 * Catapult pods are allocated per match. On 23/09/26 v Stockport the Prem
 * squad wore P1–P14 and Caleb McWilliam wore P13, while his permanent
 * users.catapult_code is P27 — so the permanent-code lookup matched nobody,
 * and any pod equal to someone else's permanent code went to the wrong player.
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
jest.mock('@/lib/auth/requireRole', () => ({ requireStaff: () => requireStaffMock() }))

import { POST } from '@/app/api/admin/gps-import/route'

type Tables = {
  users: { id: string; name: string; catapult_code: string | null; role: string }[]
  match_events: { id: string; opponent: string; match_date: string; status: string }[]
  match_squads: { match_id: string; player_id: string; gps_number: number | null }[]
}

/** Minimal chainable stand-in for the service-role client's query builder. */
function fakeAdmin(tables: Tables) {
  const inserts: Record<string, unknown>[] = []
  function from(table: keyof Tables | 'gps_sessions') {
    const filters: ((row: Record<string, unknown>) => boolean)[] = []
    let op: 'select' | 'delete' = 'select'
    const builder = {
      select: () => builder,
      delete: () => { op = 'delete'; return builder },
      eq: (col: string, val: unknown) => { filters.push(r => r[col] === val); return builder },
      neq: (col: string, val: unknown) => { filters.push(r => r[col] !== val); return builder },
      insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: null } },
      then: (resolve: (v: unknown) => void) => {
        if (op === 'delete' || table === 'gps_sessions') return resolve({ data: null, error: null })
        const rows = (tables[table] as Record<string, unknown>[]).filter(r => filters.every(f => f(r)))
        return resolve({ data: rows, error: null })
      },
    }
    return builder
  }
  return { client: { from }, inserts }
}

// Date 46288 is Excel's serial for 2026-09-23 — the real export's format.
const HEADER = 'Date,Session Title,Player Name,Split Name,Duration,Distance (metres),Sprint Distance (m)'
const row = (pod: number, title = 'TR Prem vs Stockport County (H)') =>
  `46288,${title},Tranmere P${pod},Full Match,6122,9000,400`

function request(lines: string[], matchId?: string): NextRequest {
  const form = new FormData()
  form.set('file', new File([[HEADER, ...lines].join('\n')], 'catapult.csv', { type: 'text/csv' }))
  if (matchId) form.set('match_id', matchId)
  return new NextRequest('http://localhost/api/admin/gps-import', { method: 'POST', body: form })
}

function run(tables: Tables, lines: string[], matchId?: string) {
  const admin = fakeAdmin(tables)
  requireStaffMock.mockResolvedValue({ ok: true, ctx: { user: { id: 'staff' }, role: 'admin', admin: admin.client } })
  return POST(request(lines, matchId)).then(async res => ({ res, body: await res.json(), inserts: admin.inserts }))
}

const stockport = { id: 'm-stockport', opponent: 'Stockport County', match_date: '2026-09-23', status: 'completed' }

// Someone else permanently owns code P13 — the trap the old lookup fell into.
const users = [
  { id: 'caleb', name: 'Caleb McWilliam', catapult_code: 'Tranmere P27', role: 'student' },
  { id: 'other', name: 'Someone Else', catapult_code: 'Tranmere P13', role: 'student' },
]

beforeEach(() => requireStaffMock.mockReset())

describe('Catapult import resolves pods through the match squad', () => {
  it("puts P13 on the player who wore pod 13 in that match, not on P13's permanent owner", async () => {
    const { res, inserts } = await run({
      users,
      match_events: [stockport],
      match_squads: [{ match_id: 'm-stockport', player_id: 'caleb', gps_number: 13 }],
    }, [row(13)])

    expect(res.status).toBe(200)
    expect(inserts.map(i => i.player_id)).toEqual(['caleb'])
    expect(inserts[0].session_date).toBe('2026-09-23')
  })

  it('reports a pod nobody wore in the match and saves nothing for it', async () => {
    const { body, inserts } = await run({
      users,
      match_events: [stockport],
      match_squads: [{ match_id: 'm-stockport', player_id: 'caleb', gps_number: 13 }],
    }, [row(13), row(14)])

    expect(inserts.map(i => i.player_id)).toEqual(['caleb'])
    expect(body.unallocated).toEqual(['Tranmere P14 (v Stockport County)'])
  })

  it('picks the right match by opponent when two games share the date', async () => {
    const { inserts } = await run({
      users,
      match_events: [{ ...stockport, id: 'm-wigan', opponent: 'Wigan' }, stockport],
      match_squads: [
        { match_id: 'm-wigan', player_id: 'other', gps_number: 13 },
        { match_id: 'm-stockport', player_id: 'caleb', gps_number: 13 },
      ],
    }, [row(13)])

    expect(inserts.map(i => i.player_id)).toEqual(['caleb'])
  })

  it('refuses to guess when two matches share the date and the title names neither', async () => {
    const { res, inserts } = await run({
      users,
      match_events: [{ ...stockport, id: 'm-wigan', opponent: 'Wigan' }, stockport],
      match_squads: [],
    }, [row(13, 'Match day')])

    expect(res.status).toBe(400)
    expect(inserts).toEqual([])
  })

  it('uses the match chosen on the form over the date lookup', async () => {
    const { inserts } = await run({
      users,
      match_events: [{ ...stockport, id: 'm-wigan', opponent: 'Wigan' }, stockport],
      match_squads: [
        { match_id: 'm-wigan', player_id: 'other', gps_number: 13 },
        { match_id: 'm-stockport', player_id: 'caleb', gps_number: 13 },
      ],
    }, [row(13, 'Match day')], 'm-wigan')

    expect(inserts.map(i => i.player_id)).toEqual(['other'])
  })

  it('ignores a cancelled match on the same date', async () => {
    const { inserts } = await run({
      users,
      match_events: [{ ...stockport, id: 'm-off', opponent: 'Wigan', status: 'cancelled' }, stockport],
      match_squads: [{ match_id: 'm-stockport', player_id: 'caleb', gps_number: 13 }],
    }, [row(13, 'Match day')])

    expect(inserts.map(i => i.player_id)).toEqual(['caleb'])
  })

  it('falls back to permanent codes when there is no match that day (training)', async () => {
    const { inserts } = await run({ users, match_events: [], match_squads: [] }, [row(27, 'Training')])

    expect(inserts.map(i => i.player_id)).toEqual(['caleb'])
  })

  it('falls back to permanent codes when the match has no pods entered yet', async () => {
    const { inserts } = await run({
      users,
      match_events: [stockport],
      match_squads: [{ match_id: 'm-stockport', player_id: 'caleb', gps_number: null }],
    }, [row(27)])

    expect(inserts.map(i => i.player_id)).toEqual(['caleb'])
  })
})
