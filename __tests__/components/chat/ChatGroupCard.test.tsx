import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatGroupCard } from '@/app/(admin)/admin/chat-groups/ChatGroupCard'

const refreshMock = jest.fn()
const pushMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock, push: pushMock }) }))

const addGroupMembersMock = jest.fn()
const removeGroupMemberMock = jest.fn()
const renameGroupChatMock = jest.fn()
const joinGroupChatMock = jest.fn()
jest.mock('@/app/chat/actions', () => ({
  addGroupMembers: (...args: any[]) => addGroupMembersMock(...args),
  removeGroupMember: (...args: any[]) => removeGroupMemberMock(...args),
  renameGroupChat: (...args: any[]) => renameGroupChatMock(...args),
  joinGroupChat: (...args: any[]) => joinGroupChatMock(...args),
}))

const members = [
  { id: 's1', name: 'Alfie Casey', role: 'student' },
  { id: 'c1', name: 'Philippa L', role: 'coach' },
]
const addable = [{ id: 'c2', name: 'Troy Lockyer', role: 'coach' }]

describe('ChatGroupCard', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    pushMock.mockClear()
    addGroupMembersMock.mockReset()
    removeGroupMemberMock.mockReset()
    renameGroupChatMock.mockReset()
    joinGroupChatMock.mockReset()
  })

  it('renders collapsed by default, showing the member count', () => {
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    expect(screen.getByText('Year 2 Students')).toBeInTheDocument()
    expect(screen.getByText(/2 members/)).toBeInTheDocument()
    expect(screen.queryByText('Alfie Casey')).not.toBeInTheDocument()
  })

  it('expands to show members and the auto-synced badge', () => {
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    fireEvent.click(screen.getByText('Year 2 Students'))
    expect(screen.getByText('Alfie Casey')).toBeInTheDocument()
    expect(screen.getByText('Philippa L')).toBeInTheDocument()
    expect(screen.getByText('Auto-synced student roster')).toBeInTheDocument()
  })

  it('hides the remove control for a student on an auto-synced roster, but shows it for staff', () => {
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    fireEvent.click(screen.getByText('Year 2 Students'))
    expect(screen.queryByLabelText('Remove Alfie Casey')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Remove Philippa L')).toBeInTheDocument()
  })

  it('shows remove for everyone on a non-synced (ad-hoc) group', () => {
    render(<ChatGroupCard roomId="r1" roomName="Ad-hoc group" syncYearGroup={null} members={members} addable={addable} />)
    fireEvent.click(screen.getByText('Ad-hoc group'))
    expect(screen.getByLabelText('Remove Alfie Casey')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove Philippa L')).toBeInTheDocument()
  })

  it('removes a member and refreshes on success', async () => {
    removeGroupMemberMock.mockResolvedValue({ ok: true })
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    fireEvent.click(screen.getByText('Year 2 Students'))
    fireEvent.click(screen.getByLabelText('Remove Philippa L'))
    await waitFor(() => expect(removeGroupMemberMock).toHaveBeenCalledWith('r1', 'c1'))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('adds selected people and refreshes on success', async () => {
    addGroupMembersMock.mockResolvedValue({ ok: true })
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    fireEvent.click(screen.getByText('Year 2 Students'))
    fireEvent.click(screen.getByText('Add people'))
    fireEvent.click(screen.getByText('Troy Lockyer'))
    fireEvent.click(screen.getByText(/Add \(1\)/))
    await waitFor(() => expect(addGroupMembersMock).toHaveBeenCalledWith('r1', ['c2']))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('shows an error instead of submitting with nobody selected', () => {
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    fireEvent.click(screen.getByText('Year 2 Students'))
    fireEvent.click(screen.getByText('Add people'))
    fireEvent.click(screen.getByText(/^Add$/))
    expect(screen.getByText('Pick at least one person')).toBeInTheDocument()
    expect(addGroupMembersMock).not.toHaveBeenCalled()
  })

  it('joins the room then navigates to it when "Open chat" is clicked', async () => {
    joinGroupChatMock.mockResolvedValue({ ok: true })
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    fireEvent.click(screen.getByLabelText('Open chat'))
    await waitFor(() => expect(joinGroupChatMock).toHaveBeenCalledWith('r1'))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/chat/r1'))
  })

  it('renames the group and refreshes on success', async () => {
    renameGroupChatMock.mockResolvedValue({ ok: true })
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    fireEvent.click(screen.getByLabelText('Rename group'))
    const input = screen.getByPlaceholderText('Group name')
    fireEvent.change(input, { target: { value: 'Year 2 Squad' } })
    fireEvent.click(screen.getByLabelText('Save name'))
    await waitFor(() => expect(renameGroupChatMock).toHaveBeenCalledWith('r1', 'Year 2 Squad'))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('shows an error instead of saving an empty rename', () => {
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    fireEvent.click(screen.getByLabelText('Rename group'))
    fireEvent.change(screen.getByPlaceholderText('Group name'), { target: { value: '   ' } })
    fireEvent.click(screen.getByLabelText('Save name'))
    expect(screen.getByText('Give the group a name')).toBeInTheDocument()
    expect(renameGroupChatMock).not.toHaveBeenCalled()
  })

  it('explains in the add panel that only staff can be added to a synced roster', () => {
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    fireEvent.click(screen.getByText('Year 2 Students'))
    fireEvent.click(screen.getByText('Add people'))
    expect(screen.getByText(/Only staff can be added here/)).toBeInTheDocument()
    expect(screen.getByText(/set their year group to 2/)).toBeInTheDocument()
  })

  it('shows no sync explanation in the add panel of a manually-managed group', () => {
    render(<ChatGroupCard roomId="r1" roomName="Strikers" syncYearGroup={null} members={members} addable={addable} />)
    fireEvent.click(screen.getByText('Strikers'))
    fireEvent.click(screen.getByText('Add people'))
    expect(screen.queryByText(/Only staff can be added here/)).not.toBeInTheDocument()
  })

  it('says everyone addable is already in, rather than "No match", on an empty list', () => {
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={[]} />)
    fireEvent.click(screen.getByText('Year 2 Students'))
    fireEvent.click(screen.getByText('Add people'))
    expect(screen.getByText('Everyone who can be added is already in')).toBeInTheDocument()
    expect(screen.queryByText('No match')).not.toBeInTheDocument()
  })

  it('still says "No match" when a search simply matches nobody', () => {
    render(<ChatGroupCard roomId="r1" roomName="Year 2 Students" syncYearGroup={2} members={members} addable={addable} />)
    fireEvent.click(screen.getByText('Year 2 Students'))
    fireEvent.click(screen.getByText('Add people'))
    fireEvent.change(screen.getByPlaceholderText('Search people...'), { target: { value: 'zzzz' } })
    expect(screen.getByText('No match')).toBeInTheDocument()
  })
})
