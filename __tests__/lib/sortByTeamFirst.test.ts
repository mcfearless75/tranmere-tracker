/**
 * @jest-environment node
 */
import { sortByTeamFirst } from '@/lib/teams/players'

type P = { id: string; team_id: string | null }

describe('sortByTeamFirst', () => {
  it('puts players on the given team before players who are not, preserving each half\'s relative order', () => {
    const players: P[] = [
      { id: 'a', team_id: 'white' },
      { id: 'b', team_id: 'prem' },
      { id: 'c', team_id: 'white' },
      { id: 'd', team_id: 'prem' },
      { id: 'e', team_id: null },
    ]
    const result = sortByTeamFirst(players, 'prem')
    expect(result.map(p => p.id)).toEqual(['b', 'd', 'a', 'c', 'e'])
  })

  it('drops nobody — everyone from the input is still present in the output', () => {
    const players: P[] = [
      { id: 'a', team_id: 'white' },
      { id: 'b', team_id: 'prem' },
      { id: 'c', team_id: null },
    ]
    const result = sortByTeamFirst(players, 'prem')
    expect(result).toHaveLength(3)
    expect(result.map(p => p.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('returns the input order unchanged when the match has no team (null)', () => {
    const players: P[] = [
      { id: 'a', team_id: 'white' },
      { id: 'b', team_id: 'prem' },
      { id: 'c', team_id: null },
    ]
    expect(sortByTeamFirst(players, null)).toEqual(players)
  })

  it('returns the input order unchanged when the match has no team (undefined)', () => {
    const players: P[] = [
      { id: 'a', team_id: 'white' },
      { id: 'b', team_id: 'prem' },
    ]
    expect(sortByTeamFirst(players, undefined)).toEqual(players)
  })

  it('is a no-op when nobody belongs to the given team', () => {
    const players: P[] = [
      { id: 'a', team_id: 'white' },
      { id: 'b', team_id: 'blue' },
    ]
    expect(sortByTeamFirst(players, 'prem')).toEqual(players)
  })
})
