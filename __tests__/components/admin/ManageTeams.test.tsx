import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ManageTeams } from '@/app/(admin)/admin/teams/ManageTeams'
import { TEAM_NAME_MAX } from '@/lib/teams/types'

/** All writes go through mocked server actions — never the real ones in a unit test. */
const createTeamMock = jest.fn()
const renameTeamMock = jest.fn()
const setTeamActiveMock = jest.fn()
const reorderTeamsMock = jest.fn()
jest.mock('@/app/(admin)/admin/teams/teamActions', () => ({
  createTeam: (...a: unknown[]) => createTeamMock(...a),
  renameTeam: (...a: unknown[]) => renameTeamMock(...a),
  setTeamActive: (...a: unknown[]) => setTeamActiveMock(...a),
  reorderTeams: (...a: unknown[]) => reorderTeamsMock(...a),
}))

const prem = { id: 't1', name: 'Prem', sort_order: 0, is_active: true }
const white = { id: 't2', name: 'White', sort_order: 1, is_active: true }
const blue = { id: 't3', name: 'Blue', sort_order: 2, is_active: true }
const teams = [prem, white, blue]

beforeEach(() => {
  createTeamMock.mockReset().mockResolvedValue({ ok: true })
  renameTeamMock.mockReset().mockResolvedValue({ ok: true })
  setTeamActiveMock.mockReset().mockResolvedValue({ ok: true })
  reorderTeamsMock.mockReset().mockResolvedValue({ ok: true })
})

describe('new team input', () => {
  it('caps the name at TEAM_NAME_MAX and keeps Add disabled for empty or whitespace-only input', () => {
    render(<ManageTeams teams={teams} />)

    const input = screen.getByLabelText('New team name')
    expect(input).toHaveAttribute('maxLength', String(TEAM_NAME_MAX))

    const add = screen.getByRole('button', { name: /add/i })
    expect(add).toBeDisabled()

    fireEvent.change(input, { target: { value: '   ' } })
    expect(add).toBeDisabled()

    fireEvent.change(input, { target: { value: 'Colts' } })
    expect(add).not.toBeDisabled()
  })

  it('shows the exact refusal reason a create can return', async () => {
    createTeamMock.mockResolvedValue({ ok: false, error: 'Team name cannot be longer than 40 characters' })
    render(<ManageTeams teams={teams} />)

    fireEvent.change(screen.getByLabelText('New team name'), { target: { value: 'Colts' } })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    expect(await screen.findByText('Team name cannot be longer than 40 characters')).toBeInTheDocument()
  })
})

describe('renaming', () => {
  it('does NOT call renameTeam when a blur leaves the value unchanged', () => {
    render(<ManageTeams teams={teams} />)

    fireEvent.blur(screen.getByLabelText('Rename White'))

    expect(renameTeamMock).not.toHaveBeenCalled()
  })

  it('calls renameTeam only when the value actually changed', async () => {
    render(<ManageTeams teams={teams} />)

    const input = screen.getByLabelText('Rename White')
    fireEvent.change(input, { target: { value: 'Whites' } })
    fireEvent.blur(input)

    await waitFor(() => expect(renameTeamMock).toHaveBeenCalledWith('t2', 'Whites'))
  })
})

describe('reordering', () => {
  it('disables "move up" on the first team and "move down" on the last team', () => {
    render(<ManageTeams teams={teams} />)

    expect(screen.getByLabelText('Move Prem up')).toBeDisabled()
    expect(screen.getByLabelText('Move Blue down')).toBeDisabled()
    // A middle team is free to move either way.
    expect(screen.getByLabelText('Move White up')).not.toBeDisabled()
    expect(screen.getByLabelText('Move White down')).not.toBeDisabled()
  })

  it('moving a middle team up sends the correctly reordered id array, not just any call', async () => {
    render(<ManageTeams teams={teams} />)

    fireEvent.click(screen.getByLabelText('Move White up'))

    // Started as [Prem, White, Blue]; moving White (index 1) to index 0 must
    // produce [White, Prem, Blue] — swapping the wrong pair would still "call
    // reorderTeams", so the array contents are what actually prove this works.
    await waitFor(() => expect(reorderTeamsMock).toHaveBeenCalledWith(['t2', 't1', 't3']))
  })

  it('moving a middle team down sends the correctly reordered id array', async () => {
    render(<ManageTeams teams={teams} />)

    fireEvent.click(screen.getByLabelText('Move White down'))

    await waitFor(() => expect(reorderTeamsMock).toHaveBeenCalledWith(['t1', 't3', 't2']))
  })
})

describe('retiring a team', () => {
  it('does not retire when the confirmation is declined', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ManageTeams teams={teams} />)

    fireEvent.click(screen.getByLabelText('Retire White'))

    expect(setTeamActiveMock).not.toHaveBeenCalled()
  })

  it('retires only after the confirmation is accepted', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ManageTeams teams={teams} />)

    fireEvent.click(screen.getByLabelText('Retire White'))

    await waitFor(() => expect(setTeamActiveMock).toHaveBeenCalledWith('t2', false))
  })
})
