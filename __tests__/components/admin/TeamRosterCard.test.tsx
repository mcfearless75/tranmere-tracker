import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TeamRosterCard } from '@/app/(admin)/admin/teams/TeamRosterCard'

/**
 * TeamRosterCard is the page's main interaction surface: it is how a coach
 * moves a player between teams and how an unassigned player gets a home. The
 * server actions are mocked — never let the real ones run in a unit test.
 */
const setUserTeamMock = jest.fn()
const addUsersToTeamMock = jest.fn()
const removeUserFromTeamMock = jest.fn()
const createTeamChatMock = jest.fn()
const pushMock = jest.fn()
jest.mock('@/app/(admin)/admin/teams/teamActions', () => ({
  setUserTeam: (...a: unknown[]) => setUserTeamMock(...a),
  addUsersToTeam: (...a: unknown[]) => addUsersToTeamMock(...a),
  removeUserFromTeam: (...a: unknown[]) => removeUserFromTeamMock(...a),
  createTeamChat: (...a: unknown[]) => createTeamChatMock(...a),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

const prem = { id: 't1', name: 'Prem', sort_order: 0, is_active: true }
const white = { id: 't2', name: 'White', sort_order: 1, is_active: true }
const teams = [prem, white]

function member(over: { id?: string; name?: string; team_id?: string | null; team_ids?: string[] } = {}) {
  const team_id = over.team_id ?? null
  return {
    id: 'p1', name: 'Alfie Casey', role: 'student', year_group: 1,
    ...over,
    team_id,
    team_ids: over.team_ids ?? (team_id ? [team_id] : []),
  }
}

beforeEach(() => {
  setUserTeamMock.mockReset().mockResolvedValue({ ok: true })
  addUsersToTeamMock.mockReset().mockResolvedValue({ ok: true })
  removeUserFromTeamMock.mockReset().mockResolvedValue({ ok: true })
  createTeamChatMock.mockReset().mockResolvedValue({ ok: true, roomId: 'room-9' })
  pushMock.mockReset()
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

    await waitFor(() => expect(removeUserFromTeamMock).toHaveBeenCalledWith('p1', 't1'))
  })

  it('shows the exact refusal reason the action returns, not a generic message', async () => {
    removeUserFromTeamMock.mockResolvedValue({ ok: false, error: 'You do not have permission to make that change — try signing in again' })
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

  it("shows a candidate's current teams, which they keep", () => {
    render(<TeamRosterCard team={prem} roster={[]} teams={teams} candidates={candidates} />)

    fireEvent.click(screen.getByText('Add players'))

    expect(screen.getByText('White')).toBeInTheDocument()
    expect(screen.getByText(/they stay in their other teams too/)).toBeInTheDocument()
  })

  it('adds exactly the picked players, and only them, to this team', async () => {
    render(<TeamRosterCard team={prem} roster={[]} teams={teams} candidates={candidates} />)

    fireEvent.click(screen.getByText('Add players'))
    fireEvent.click(screen.getByText('Troy Lockyer'))
    fireEvent.click(screen.getByText('Ben Tollitt'))
    fireEvent.click(screen.getByText('Add 2 to Prem'))

    await waitFor(() => expect(addUsersToTeamMock).toHaveBeenCalledWith(['p2', 'p3'], 't1'))
  })

  it('does not include an unpicked candidate', async () => {
    render(<TeamRosterCard team={prem} roster={[]} teams={teams} candidates={candidates} />)

    fireEvent.click(screen.getByText('Add players'))
    fireEvent.click(screen.getByText('Troy Lockyer'))
    fireEvent.click(screen.getByText('Add 1 to Prem'))

    await waitFor(() => expect(addUsersToTeamMock).toHaveBeenCalledWith(['p2'], 't1'))
  })
})

describe('multiple teams', () => {
  it("shows a roster player's other teams", () => {
    render(
      <TeamRosterCard team={prem} teams={teams} candidates={[]}
        roster={[member({ id: 'p1', name: 'Alfie Casey', team_id: 't1', team_ids: ['t1', 't2'] })]} />
    )
    expect(screen.getByText('White')).toBeInTheDocument()
  })
})

describe('squad chat', () => {
  it('links to an existing squad chat', () => {
    render(<TeamRosterCard team={prem} roster={[]} teams={teams} candidates={[]} chatRoomId="room-1" />)
    expect(screen.getByText('Squad chat').closest('a')).toHaveAttribute('href', '/chat/room-1')
  })

  it('creates the chat and opens it', async () => {
    render(<TeamRosterCard team={prem} roster={[]} teams={teams} candidates={[]} />)
    fireEvent.click(screen.getByText('Create chat'))
    await waitFor(() => expect(createTeamChatMock).toHaveBeenCalledWith('t1'))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/chat/room-9'))
  })
})
