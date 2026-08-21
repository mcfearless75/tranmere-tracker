import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddGroupMembers } from '@/app/chat/[roomId]/AddGroupMembers'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const addGroupMembersMock = jest.fn()
jest.mock('@/app/chat/actions', () => ({
  addGroupMembers: (...args: any[]) => addGroupMembersMock(...args),
}))

const addable = [{ id: 'u3', name: 'Carla Teacher', role: 'teacher' }]

describe('AddGroupMembers', () => {
  beforeEach(() => { refreshMock.mockClear(); addGroupMembersMock.mockReset() })

  it('renders nothing when there is nobody left to add', () => {
    const { container } = render(<AddGroupMembers roomId="r1" addable={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens and lists addable people', () => {
    render(<AddGroupMembers roomId="r1" addable={addable} />)
    fireEvent.click(screen.getByText('Add people'))
    expect(screen.getByText('Carla Teacher')).toBeInTheDocument()
  })

  it('shows an error instead of submitting with nobody selected', () => {
    render(<AddGroupMembers roomId="r1" addable={addable} />)
    fireEvent.click(screen.getByText('Add people'))
    fireEvent.click(screen.getByText(/^Add$/))
    expect(screen.getByText('Pick at least one person')).toBeInTheDocument()
    expect(addGroupMembersMock).not.toHaveBeenCalled()
  })

  it('submits selected ids and refreshes on success', async () => {
    addGroupMembersMock.mockResolvedValue({ ok: true })
    render(<AddGroupMembers roomId="r1" addable={addable} />)
    fireEvent.click(screen.getByText('Add people'))
    fireEvent.click(screen.getByText('Carla Teacher'))
    fireEvent.click(screen.getByText(/Add \(1\)/))
    await waitFor(() => expect(addGroupMembersMock).toHaveBeenCalledWith('r1', ['u3']))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })
})
