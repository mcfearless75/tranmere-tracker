import { teamIdsOf, isInTeam, sortByTeamFirst, PLAYER_TEAM_COLUMNS } from '@/lib/teams/players'

describe('multi-team membership helpers', () => {
  it('reads every team from team_members', () => {
    expect(teamIdsOf({ team_id: 'a', team_members: [{ team_id: 'a' }, { team_id: 'b' }] })).toEqual(['a', 'b'])
  })
  it('falls back to the main team when team_members was not loaded', () => {
    expect(teamIdsOf({ team_id: 'a' })).toEqual(['a'])
    expect(teamIdsOf({ team_id: null })).toEqual([])
  })
  it('isInTeam matches a secondary team', () => {
    const p = { team_id: 'a', team_members: [{ team_id: 'a' }, { team_id: 'b' }] }
    expect(isInTeam(p, 'b')).toBe(true)
    expect(isInTeam(p, 'c')).toBe(false)
    expect(isInTeam(p, null)).toBe(false)
  })
  it('sortByTeamFirst puts secondary-team players in the team half', () => {
    const players = [
      { id: '1', team_id: 'white', team_members: [{ team_id: 'white' }] },
      { id: '2', team_id: 'white', team_members: [{ team_id: 'white' }, { team_id: 'prem' }] },
      { id: '3', team_id: 'prem', team_members: [{ team_id: 'prem' }] },
    ]
    expect(sortByTeamFirst(players, 'prem').map(p => p.id)).toEqual(['2', '3', '1'])
  })
  it('disambiguates the teams embed now that team_members links users and teams', () => {
    expect(PLAYER_TEAM_COLUMNS).toContain('teams!users_team_id_fkey(')
    expect(PLAYER_TEAM_COLUMNS).toContain('team_members(team_id)')
  })
})
