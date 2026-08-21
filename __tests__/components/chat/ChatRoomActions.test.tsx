import { render, screen, fireEvent } from '@testing-library/react'
import { ChatRoomActions } from '@/app/chat/ChatRoomActions'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('@/app/chat/actions', () => ({
  nudgeRoom: jest.fn(),
  leaveOrDeleteRoom: jest.fn(),
}))

describe('ChatRoomActions — canLeave', () => {
  it('shows "Leave conversation" in the menu by default', () => {
    render(<ChatRoomActions roomId="r1" isOwner={false} isDmOrBot={false} />)
    fireEvent.click(screen.getByLabelText('Chat options'))
    expect(screen.getByText('Leave conversation')).toBeInTheDocument()
  })

  it('hides the leave/delete menu item when canLeave is false', () => {
    render(<ChatRoomActions roomId="r1" isOwner={false} isDmOrBot={false} canLeave={false} />)
    fireEvent.click(screen.getByLabelText('Chat options'))
    expect(screen.queryByText('Leave conversation')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete conversation')).not.toBeInTheDocument()
  })

  it('still shows Nudge when canLeave is false', () => {
    render(<ChatRoomActions roomId="r1" isOwner={false} isDmOrBot={false} canLeave={false} />)
    fireEvent.click(screen.getByLabelText('Chat options'))
    expect(screen.getByText('Nudge')).toBeInTheDocument()
  })
})
