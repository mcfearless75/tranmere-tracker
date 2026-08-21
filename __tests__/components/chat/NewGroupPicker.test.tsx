import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewGroupPicker } from '@/app/chat/NewGroupPicker'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

const createGroupChatMock = jest.fn()
jest.mock('@/app/chat/actions', () => ({
  createGroupChat: (...args: any[]) => createGroupChatMock(...args),
}))

const directory = [
  { id: 'u1', name: 'Alice Coach', role: 'coach', avatar_url: null },
  { id: 'u2', name: 'Bob Student', role: 'student', avatar_url: null },
]

describe('NewGroupPicker', () => {
  beforeEach(() => {
    pushMock.mockClear()
    createGroupChatMock.mockReset()
  })

  it('opens the picker and lists the directory', () => {
    render(<NewGroupPicker directory={directory} />)
    fireEvent.click(screen.getByText('New group'))
    expect(screen.getByText('Alice Coach')).toBeInTheDocument()
    expect(screen.getByText('Bob Student')).toBeInTheDocument()
  })

  it('shows an error instead of submitting when no name is entered', () => {
    render(<NewGroupPicker directory={directory} />)
    fireEvent.click(screen.getByText('New group'))
    fireEvent.click(screen.getByText('Bob Student'))
    fireEvent.click(screen.getByText(/Create group/))
    expect(screen.getByText('Give the group a name')).toBeInTheDocument()
    expect(createGroupChatMock).not.toHaveBeenCalled()
  })

  it('shows an error instead of submitting when no member is selected', () => {
    render(<NewGroupPicker directory={directory} />)
    fireEvent.click(screen.getByText('New group'))
    fireEvent.change(screen.getByPlaceholderText(/Group name/), { target: { value: 'Match Day Chat' } })
    fireEvent.click(screen.getByText(/Create group/))
    expect(screen.getByText('Pick at least one member')).toBeInTheDocument()
    expect(createGroupChatMock).not.toHaveBeenCalled()
  })

  it('submits the name and selected member ids, then navigates to the new room', async () => {
    createGroupChatMock.mockResolvedValue('room-123')
    render(<NewGroupPicker directory={directory} />)
    fireEvent.click(screen.getByText('New group'))
    fireEvent.change(screen.getByPlaceholderText(/Group name/), { target: { value: 'Match Day Chat' } })
    fireEvent.click(screen.getByText('Bob Student'))
    fireEvent.click(screen.getByText(/Create group/))
    await waitFor(() => expect(createGroupChatMock).toHaveBeenCalledWith('Match Day Chat', ['u2']))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/chat/room-123'))
  })
})
