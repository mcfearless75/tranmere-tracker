import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StudentIdentityForm } from '@/app/(admin)/admin/students/[id]/StudentIdentityForm'

const updateUserNameMock = jest.fn()
const updateUserYearGroupMock = jest.fn()
const setUserTeamMock = jest.fn()

jest.mock('@/app/(admin)/admin/users/userActions', () => ({
  updateUserName: (...a: any[]) => updateUserNameMock(...a),
  updateUserYearGroup: (...a: any[]) => updateUserYearGroupMock(...a),
}))

jest.mock('@/app/(admin)/admin/teams/teamActions', () => ({
  setUserTeam: (...a: any[]) => setUserTeamMock(...a),
}))

const TEAMS = [
  { id: 't1', name: 'Prem', sort_order: 0, is_active: true },
  { id: 't2', name: 'White', sort_order: 1, is_active: true },
]

function renderForm(over: Record<string, unknown> = {}) {
  return render(
    <StudentIdentityForm
      userId="s1"
      name="Javan Moussa"
      yearGroup={1}
      isStudent
      teamId={null}
      teams={TEAMS}
      {...(over as any)}
    />
  )
}

function startEditing() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
}

describe('StudentIdentityForm', () => {
  beforeEach(() => {
    updateUserNameMock.mockReset().mockResolvedValue({ ok: true })
    updateUserYearGroupMock.mockReset().mockResolvedValue({ ok: true })
    setUserTeamMock.mockReset().mockResolvedValue({ ok: true })
  })

  it('shows the current name and year group before editing', () => {
    renderForm()
    expect(screen.getByText('Javan Moussa')).toBeInTheDocument()
    expect(screen.getByText('Year 1')).toBeInTheDocument()
  })

  it('shows the current team before editing, and "No team" when unassigned', () => {
    renderForm()
    expect(screen.getByText('No team')).toBeInTheDocument()
  })

  it('shows the assigned team name before editing', () => {
    renderForm({ teamId: 't2' })
    expect(screen.getByText('White')).toBeInTheDocument()
  })

  it('renames a user', async () => {
    renderForm()
    startEditing()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Javan Moussa-Smith' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateUserNameMock).toHaveBeenCalledWith('s1', 'Javan Moussa-Smith'))
    expect(updateUserYearGroupMock).not.toHaveBeenCalled()
  })

  it('changes the year group', async () => {
    renderForm()
    startEditing()
    fireEvent.change(screen.getByLabelText('Year group'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateUserYearGroupMock).toHaveBeenCalledWith('s1', 2))
    // Name was untouched, so it should not be written back needlessly.
    expect(updateUserNameMock).not.toHaveBeenCalled()
  })

  it('saves both when both changed', async () => {
    renderForm()
    startEditing()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Javan M' } })
    fireEvent.change(screen.getByLabelText('Year group'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateUserNameMock).toHaveBeenCalledWith('s1', 'Javan M'))
    expect(updateUserYearGroupMock).toHaveBeenCalledWith('s1', 2)
  })

  it('assigns a team', async () => {
    renderForm()
    startEditing()
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: 't1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(setUserTeamMock).toHaveBeenCalledWith('s1', 't1'))
    expect(updateUserNameMock).not.toHaveBeenCalled()
    expect(updateUserYearGroupMock).not.toHaveBeenCalled()
  })

  // NULL, not an empty string — team_id is a nullable FK, not a text column.
  it('unassigns a team with NULL when the blank option is chosen', async () => {
    renderForm({ teamId: 't1' })
    startEditing()
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(setUserTeamMock).toHaveBeenCalledWith('s1', null))
    expect(setUserTeamMock).not.toHaveBeenCalledWith('s1', '')
  })

  it('does not call setUserTeam when the team was left unchanged', async () => {
    renderForm({ teamId: 't1' })
    startEditing()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Javan M' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateUserNameMock).toHaveBeenCalledWith('s1', 'Javan M'))
    expect(setUserTeamMock).not.toHaveBeenCalled()
  })

  // The coach-who-plays invariant: unlike the year group, the team control is
  // NOT students-only — a coach who plays needs a team too.
  it('still shows and allows editing the team for staff', async () => {
    renderForm({ isStudent: false, name: 'Philippa L', yearGroup: null, teamId: null })
    expect(screen.getByText('No team')).toBeInTheDocument()

    startEditing()
    expect(screen.getByLabelText('Team')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: 't2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(setUserTeamMock).toHaveBeenCalledWith('s1', 't2'))
  })

  it('will not save an empty name', () => {
    renderForm()
    startEditing()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('caps the name input so it cannot exceed the server limit', () => {
    renderForm()
    startEditing()
    expect(screen.getByLabelText('Full name')).toHaveAttribute('maxLength', '80')
  })

  it('hides the year group for staff but still allows a rename', async () => {
    renderForm({ isStudent: false, name: 'Philippa L', yearGroup: null })
    expect(screen.queryByText(/Year group/)).not.toBeInTheDocument()

    startEditing()
    expect(screen.queryByLabelText('Year group')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Philippa Lomax' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updateUserNameMock).toHaveBeenCalledWith('s1', 'Philippa Lomax'))
    expect(updateUserYearGroupMock).not.toHaveBeenCalled()
  })

  it('surfaces a returned refusal instead of silently closing', async () => {
    updateUserNameMock.mockResolvedValue({ ok: false, error: 'Name cannot be empty' })
    renderForm()
    startEditing()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Someone Else' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Name cannot be empty')).toBeInTheDocument()
    // Still in edit mode, so the staff member can correct it.
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
  })

  it('surfaces a transport failure too', async () => {
    updateUserNameMock.mockRejectedValue(new Error('Failed to fetch'))
    renderForm()
    startEditing()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Someone Else' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
  })

  // A refused rename used to let the year group write go ahead anyway and the
  // form close on "Saved", because neither result was read.
  it('does not save the year group when the rename is refused', async () => {
    updateUserNameMock.mockResolvedValue({ ok: false, error: 'Name cannot be empty' })
    renderForm()
    startEditing()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Someone Else' } })
    fireEvent.change(screen.getByLabelText('Year group'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Name cannot be empty')).toBeInTheDocument()
    expect(updateUserYearGroupMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('reports a refused year group rather than closing on "Saved"', async () => {
    updateUserYearGroupMock.mockResolvedValue({ ok: false, error: 'sync_year_group_chat failed' })
    renderForm()
    startEditing()
    fireEvent.change(screen.getByLabelText('Year group'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('sync_year_group_chat failed')).toBeInTheDocument()
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('discards changes on cancel', () => {
    renderForm()
    startEditing()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Wrong Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Javan Moussa')).toBeInTheDocument()
    expect(updateUserNameMock).not.toHaveBeenCalled()
  })
})
