import { podNumber, pickMatchForSession, findNumberClashes, buildPodMap } from '@/lib/gps/matchPods'

describe('podNumber', () => {
  it.each([
    ['Tranmere P13', 13],
    ['tranmere p4', 4],
    ['P 7', 7],
    ['  Tranmere P10 ', 10],
  ])('reads %p as pod %p', (raw, n) => {
    expect(podNumber(raw)).toBe(n)
  })

  it.each(['Caleb McWilliam', '', 'Tranmere'])('returns null for %p', (raw) => {
    expect(podNumber(raw)).toBeNull()
  })
})

describe('pickMatchForSession', () => {
  const stockport = { id: 'm1', opponent: 'Stockport County' }
  const wigan = { id: 'm2', opponent: 'Wigan' }

  it('returns none when there is no match that day', () => {
    expect(pickMatchForSession([], 'TR Prem vs Stockport County (H)')).toEqual({ kind: 'none' })
  })

  it('takes the only match that day even if the title does not name it', () => {
    expect(pickMatchForSession([stockport], 'Friday game')).toEqual({ kind: 'match', match: stockport })
  })

  it('picks by opponent in the session title when two matches share a date', () => {
    expect(pickMatchForSession([wigan, stockport], 'TR Prem vs Stockport County (H)'))
      .toEqual({ kind: 'match', match: stockport })
  })

  it('is case-insensitive about the opponent', () => {
    expect(pickMatchForSession([wigan, stockport], 'tr prem v STOCKPORT COUNTY'))
      .toEqual({ kind: 'match', match: stockport })
  })

  it('reports ambiguity rather than guessing when the title names neither', () => {
    expect(pickMatchForSession([wigan, stockport], 'Match day')).toEqual({ kind: 'ambiguous' })
  })
})

describe('findNumberClashes', () => {
  it('finds nothing when every number is distinct or empty', () => {
    const c = findNumberClashes([
      { playerId: 'a', shirt: 1, gps: 1 },
      { playerId: 'b', shirt: 2, gps: 2 },
      { playerId: 'c', shirt: null, gps: null },
      { playerId: 'd', shirt: null, gps: null },
    ])
    expect(c.shirt.size).toBe(0)
    expect(c.gps.size).toBe(0)
  })

  it('flags every player sharing a shirt, and separately every player sharing a pod', () => {
    const c = findNumberClashes([
      { playerId: 'a', shirt: 5, gps: 1 },
      { playerId: 'b', shirt: 5, gps: 2 },
      { playerId: 'c', shirt: 6, gps: 2 },
    ])
    expect([...c.shirt].sort()).toEqual(['a', 'b'])
    expect([...c.gps].sort()).toEqual(['b', 'c'])
  })
})

describe('buildPodMap', () => {
  it('maps pod number to player and skips players with no pod', () => {
    const map = buildPodMap([
      { player_id: 'caleb', gps_number: 13 },
      { player_id: 'blake', gps_number: 1 },
      { player_id: 'unset', gps_number: null },
    ])
    expect(map.get(13)).toBe('caleb')
    expect(map.get(1)).toBe('blake')
    expect(map.size).toBe(2)
  })
})
