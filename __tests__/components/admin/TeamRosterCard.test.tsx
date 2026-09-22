import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TeamRosterCard } from '@/app/(admin)/admin/teams/TeamRosterCard'

/**
 * TeamRosterCard is the page's main interaction surface: it is how a coach
 * moves a player between teams and how an unassigned player gets a home. The
 * server actions are mocked — never let the real ones run in a unit test.
 */
const setUserTeamMock = jest.fn()
const setUsersTeamMock = jest.fn()
jest.mock('@/app/(admin)/admin/teams/teamActions', () => ({
  setUserTeam: (...a: unknown[]) => setUserTeamMock(...a),
  setUsersTeam: (...a: unknown[]) => setUsersTeamMock(...a),
}))

const prem = { id: 't1', name: 'Prem', sort_order: 0, is_active: true }
const white = { id: 't2', name: 'White', sort_order: 1, is_active: true }
const teams = [prem, white]

function member(over: Record<string, unknown> = {}) {
  return {
    id: 'p1', name: 'Alfie Casey', role: 'student', year_group: 1, team_id: null,
    ...over,
  }
}

beforeEach(() => {
  setUserTeamMock.mockReset().mockResolvedValue({ ok: true })
  setUsersTeamMock.mockReset().mockResolvedValue({ ok: true })
})

describe('the Unassigned bucket (team=null)', () => {
  it('offers a "Place in…" select per player, and never a remove control', () => {
    render(
      <TeamRosterCard
        team={null}
        roster={[member({ id: 'p1', name: 'Alfie Casey' })]}
        teams={teams}
        candidates={[]}
      />
    )

    const select = screen.getByLabelText('Team for Alfie Casey') as HTMLSelectElement
    // "Place in…" plus one option per active team.
    expect(select.options).toHaveLength(3)
    expect(select.options[0]).toHaveTextContent('Place in…')
    expect(select.options[1]).toHaveTextContent('Prem')
    expect(select.options[2]).toHaveTextContent('White')

    // If this ever renders a remove (X) control here, an unassigned player
    // could be "removed" from nothing, which makes no sense for this bucket.
    expect(screen.queryByLabelText(/^Remove /)).not.toBeInTheDocument()
  })

  it('places a player in the chosen team via setUserTeam', async () => {
    render(
      <TeamRosterCard
        team={null}
        roster={[member({ id: 'p1', name: 'Alfie Casey' })]}
        teams={teams}
        candidates={[]}
      />
    )

    fireEvent.change(screen.getByLabelText('Team for Alfie Casey'), { target: { value: 't1' } })

    await waitFor(() => expect(setUserTeamMock).toHaveBeenCalledWith('p1', 't1'))
  })
})

describe('a team roster', () => {
  it('removes a player via a control whose accessible name identifies both the player and the team', async () => {
    render(
      <TeamRosterCard
        team={prem}
        roster={[member({ id: 'p1', name: 'Alfie Casey', team_id: 't1' })]}
        teams={teams}
        candidates={[]}
      />
    )

    const remove = screen.getByLabelText('Remove Alfie Casey from Prem')
    fireEvent.click(remove)

    await waitFor(() => expect(setUserTeamMock).toHaveBeenCalledWith('p1', null))
  })

  it('shows the exact refusal reason the action returns, not a generic message', async () => {
    setUserTeamMock.mockResolvedValue({ ok: false, error: 'You do not have permission to make that change — try signing in again' })
    render(
      <TeamRosterCard
        team={prem}
        roster={[member({ id: 'p1', name: 'Alfie Casey', team_id: 't1' })]}
        teams={teams}
        candidates={[]}
      />
    )

    fireEvent.click(screen.getByLabelText('Remove Alfie Casey from Prem'))

    expect(await screen.findByText('You do not have permission to make that change — try signing in again')).toBeInTheDocument()
    expect(screen.queryByText('Not saved — try again')).not.toBeInTheDocument()
  })
})

describe('Add players', () => {
  const candidates = [
    member({ id: 'p2', name: 'Troy Lockyer', team_id: 't2' }),
    member({ id: 'p3', name: 'Ben Tollitt', team_id: null }),
  ]

  it("shows a candidate's CURRENT team, so a coach can see they are moving them, not copying them", () => {
    render(<TeamRosterCard team={prem} roster={[]} teams={teams} candidates={candidates} />)

    fireEvent.click(screen.getByText('Add players'))

    // Troy is currently on White — that must be visible in the picker for the
    // move to be an informed one, not a guess.
    expect(screen.getByText('White')).toBeInTheDocument()
  })

  it('moves exactly the picked players, and only them, to this team', async () => {
    render(<TeamRosterCard team={prem} roster={[]} teams={teams} candidates={candidates} />)

    fireEvent.click(screen.getByText('Add players'))
    fireEvent.click(screen.getByText('Troy Lockyer'))
    fireEvent.click(screen.getByText('Ben Tollitt'))
    fireEvent.click(screen.getByText('Move 2 to Prem'))

    await waitFor(() => expect(setUsersTeamMock).toHaveBeenCalledWith(['p2', 'p3'], 't1'))
  })

  it('does not include an unpicked candidate in the move', async () => {
    render(<TeamRosterCard team={prem} roster={[]} teams={teams} candidates={candidates} />)

    fireEvent.click(screen.getByText('Add players'))
    fireEvent.click(screen.getByText('Troy Lockyer'))
    fireEvent.click(screen.getByText('Move 1 to Prem'))

    await waitFor(() => expect(setUsersTeamMock).toHaveBeenCalledWith(['p2'], 't1'))
  })
})
