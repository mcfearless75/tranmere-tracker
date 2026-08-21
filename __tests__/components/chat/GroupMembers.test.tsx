import { render, screen, fireEvent } from '@testing-library/react'
import { GroupMembers } from '@/app/chat/[roomId]/GroupMembers'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const removeGroupMemberMock = jest.fn()
jest.mock('@/app/chat/actions', () => ({
  removeGroupMember: (...args: any[]) => removeGroupMemberMock(...args),
}))

const members = [
  { user_id: 'me', role: 'owner', users: { id: 'me', name: 'Coach Me', avatar_url: null, role: 'coach' } },
  { user_id: 'u2', role: 'member', users: { id: 'u2', name: 'Bob Student', avatar_url: null, role: 'student' } },
]

describe('GroupMembers', () => {
  beforeEach(() => { refreshMock.mockClear(); removeGroupMemberMock.mockReset() })

  it('shows the member count and names', () => {
    render(<GroupMembers roomId="r1" members={members} currentUserId="me" isStaff={true} syncYearGroup={null} />)
    expect(screen.getByText('2 members')).toBeInTheDocument()
    expect(screen.getByText('Bob Student')).toBeInTheDocument()
  })

  it('shows the auto-synced badge and no remove controls for a sync room', () => {
    render(<GroupMembers roomId="r1" members={members} currentUserId="me" isStaff={true} syncYearGroup={1} />)
    expect(screen.getByText('Auto-synced roster')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument()
  })

  it('shows a remove control for other members but not for yourself, when staff on a manual group', () => {
    render(<GroupMembers roomId="r1" members={members} currentUserId="me" isStaff={true} syncYearGroup={null} />)
    expect(screen.getByLabelText('Remove Bob Student')).toBeInTheDocument()
    expect(screen.queryByLabelText('Remove Coach Me')).not.toBeInTheDocument()
  })

  it('shows no remove controls for a non-staff viewer', () => {
    render(<GroupMembers roomId="r1" members={members} currentUserId="u2" isStaff={false} syncYearGroup={null} />)
    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument()
  })

  it('calls removeGroupMember with the room and user id on click', () => {
    removeGroupMemberMock.mockResolvedValue({ ok: true })
    render(<GroupMembers roomId="r1" members={members} currentUserId="me" isStaff={true} syncYearGroup={null} />)
    fireEvent.click(screen.getByLabelText('Remove Bob Student'))
    expect(removeGroupMemberMock).toHaveBeenCalledWith('r1', 'u2')
  })
})
