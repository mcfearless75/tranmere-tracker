import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FormationBuilder } from '@/app/(admin)/admin/formation/FormationBuilder'

/**
 * Regression coverage for the silent no-op reported live: placing a
 * student on the pitch who was never invited to the match (not in
 * match_squads) used to call .update().eq('match_id',…).eq('player_id',…)
 * — matching zero rows, since no row existed to update — so the
 * placement was quietly lost and the player was never notified. save()
 * now inserts a new match_squads row for any placement the caller hasn't
 * seen before (existingSquadPlayerIds) and fires the same squad-invite
 * push CreateMatchForm sends on initial creation.
 */
const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const updateEq2 = jest.fn(() => Promise.resolve({ error: null }))
const updateEq1 = jest.fn(() => ({ eq: updateEq2 }))
const update = jest.fn(() => ({ eq: updateEq1 }))
const insert = jest.fn(() => Promise.resolve({ error: null }))
const from = jest.fn(() => ({ update, insert }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from }) }))

const fetchMock = jest.fn((..._args: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
;(global as any).fetch = fetchMock

const students = [
  { id: 'p1', name: 'Alfie Casey', avatar_url: null, year_group: 1, role: 'student', team_id: null, teams: null },
  { id: 'p2', name: 'Troy Lockyer', avatar_url: null, year_group: 2, role: 'student', team_id: null, teams: null },
]
const matches = [
  { id: 'm1', match_date: '2026-10-01', kick_off_time: '18:30', opponent: 'Everton Academy', status: 'upcoming', team_id: null },
]

function place(playerLastName: string) {
  fireEvent.click(screen.getByLabelText('Place player at GK'))
  fireEvent.click(screen.getByText(playerLastName))
}

describe('FormationBuilder — save()', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    update.mockClear(); updateEq1.mockClear(); updateEq2.mockClear()
    insert.mockClear(); from.mockClear()
    fetchMock.mockClear()
  })

  it('inserts a match_squads row and notifies a brand-new player placed on the pitch', async () => {
    render(
      <FormationBuilder
        students={students}
        matches={matches}
        selectedMatchId="m1"
        initialSquad={[]}
        existingSquadPlayerIds={[]}
      />
    )
    place('Casey')
    fireEvent.click(screen.getByText('Save Formation to Match'))

    await waitFor(() => expect(insert).toHaveBeenCalledWith([
      { match_id: 'm1', player_id: 'p1', position: 'gk', status: 'invited' },
    ]))
    expect(update).not.toHaveBeenCalled()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/push/send', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)
    expect(body.targetUserIds).toEqual(['p1'])
    expect(body.title).toBe('New match published')
    expect(body.body).toContain('Everton Academy')

    await waitFor(() => expect(screen.getByText(/1 new player\(s\) notified/)).toBeInTheDocument())
  })

  it('only updates position for a player already in match_squads — no insert, no notification', async () => {
    render(
      <FormationBuilder
        students={students}
        matches={matches}
        selectedMatchId="m1"
        initialSquad={[]}
        existingSquadPlayerIds={['p1']}
      />
    )
    place('Casey')
    fireEvent.click(screen.getByText('Save Formation to Match'))

    await waitFor(() => expect(update).toHaveBeenCalledWith({ position: 'gk' }))
    expect(updateEq1).toHaveBeenCalledWith('match_id', 'm1')
    expect(updateEq2).toHaveBeenCalledWith('player_id', 'p1')
    expect(insert).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('FormationBuilder — squad chips: team ordering and badges', () => {
  const PREM = { id: 't-prem', name: 'Prem' }
  const WHITE = { id: 't-white', name: 'White' }
  const BLUE = { id: 't-blue', name: 'Blue' }

  // Deliberately mirrors the real bug: Joseph Barton is a coach who plays,
  // and users.year_group DEFAULTs to 1 for every row including staff — so
  // without the role guard he'd show a false "Y1" badge.
  const teamStudents = [
    { id: 's1', name: 'Alfie Whiteman', avatar_url: null, year_group: 1, role: 'student', team_id: 't-white', teams: WHITE },
    { id: 's2', name: 'Ben Bluefield', avatar_url: null, year_group: 2, role: 'student', team_id: 't-blue', teams: BLUE },
    { id: 's3', name: 'Joseph Barton', avatar_url: null, year_group: 1, role: 'coach', team_id: 't-prem', teams: PREM },
    { id: 's4', name: 'Callum Premley', avatar_url: null, year_group: 2, role: 'student', team_id: 't-prem', teams: PREM },
  ]
  const premMatch = [
    { id: 'm1', match_date: '2026-10-01', kick_off_time: null, opponent: 'Test FC', status: 'upcoming', team_id: 't-prem' },
  ]

  function chipButton(lastName: string) {
    return screen.getByText(lastName).closest('button') as HTMLButtonElement
  }

  it("sorts the selected match's own team before everyone else in the squad chips", () => {
    render(
      <FormationBuilder
        students={teamStudents}
        matches={premMatch}
        selectedMatchId="m1"
        initialSquad={[]}
        existingSquadPlayerIds={[]}
      />
    )
    const surnames = ['Barton', 'Premley', 'Whiteman', 'Bluefield']
    const allButtons = Array.from(document.querySelectorAll('button'))
    const positions = surnames.map(n => allButtons.indexOf(chipButton(n)))
    // Both Prem players (Barton, Premley) must come before both non-Prem
    // players (Whiteman on White, Bluefield on Blue).
    const [bartonPos, premleyPos, whitemanPos, bluefieldPos] = positions
    expect(bartonPos).toBeLessThan(whitemanPos)
    expect(bartonPos).toBeLessThan(bluefieldPos)
    expect(premleyPos).toBeLessThan(whitemanPos)
    expect(premleyPos).toBeLessThan(bluefieldPos)
  })

  it('renders a team badge for a player who has a team', () => {
    render(
      <FormationBuilder
        students={teamStudents}
        matches={premMatch}
        selectedMatchId="m1"
        initialSquad={[]}
        existingSquadPlayerIds={[]}
      />
    )
    expect(chipButton('Premley').textContent).toContain('Prem')
  })

  it('renders NO year badge for a player whose role is not student (the Joseph Barton guard)', () => {
    render(
      <FormationBuilder
        students={teamStudents}
        matches={premMatch}
        selectedMatchId="m1"
        initialSquad={[]}
        existingSquadPlayerIds={[]}
      />
    )
    // Joseph Barton is a coach with year_group 1 (the column default) — he
    // must not show "Y1".
    expect(chipButton('Barton').textContent).not.toContain('Y1')
  })

  it('DOES render a year badge for a student, so the guard is not hiding it for everyone', () => {
    render(
      <FormationBuilder
        students={teamStudents}
        matches={premMatch}
        selectedMatchId="m1"
        initialSquad={[]}
        existingSquadPlayerIds={[]}
      />
    )
    expect(chipButton('Whiteman').textContent).toContain('Y1')
    expect(chipButton('Bluefield').textContent).toContain('Y2')
  })
})
