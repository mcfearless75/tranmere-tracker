import { render, screen, fireEvent } from '@testing-library/react'
import { ChatRoomList, type ChatListRoom } from '@/components/chat/ChatRoomList'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))
jest.mock('@/app/chat/actions', () => ({
  getOrCreateDM: jest.fn(() => Promise.resolve('new-room')),
  nudgeRoom: jest.fn(),
  leaveOrDeleteRoom: jest.fn(),
}))

const room = (over: Partial<ChatListRoom>): ChatListRoom => ({
  id: 'r', kind: 'dm', label: '', otherUserId: null, avatarUrl: null, memberNames: [],
  lastMessage: null, unread: 0, isOwner: false, syncYearGroup: null, ...over,
})

const rooms = [
  room({ id: 'dm', label: 'Lewis White', otherUserId: 'lewis', lastMessage: 'see you' }),
  room({ id: 'g', kind: 'custom', label: 'Prem Squad', memberNames: ['Lewis White'] }),
  room({ id: 'b', kind: 'squad', label: 'Blue' }),
]
const directory = [
  { id: 'lewis', name: 'Lewis White', role: 'student', avatar_url: null },
  { id: 'lb', name: 'Lewis Brown', role: 'student', avatar_url: null },
]

it('filters the list and offers new chats with matching people', () => {
  render(<ChatRoomList rooms={rooms} directory={directory} />)
  expect(screen.getByText('Blue')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: 'lewis' } })
  expect(screen.queryByText('Blue')).toBeNull()
  expect(screen.getAllByText('Lewis White').length).toBeGreaterThan(0)
  expect(screen.getByText('Prem Squad')).toBeInTheDocument()
  expect(screen.getByText('Includes')).toBeInTheDocument()
  expect(screen.getByText('Start a new chat')).toBeInTheDocument()
  expect(screen.getByText('Lewis Brown')).toBeInTheDocument()
})

it('shows an empty state when nothing matches', () => {
  render(<ChatRoomList rooms={rooms} directory={directory} />)
  fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: 'zzz' } })
  expect(screen.getByText(/No chats or people match/)).toBeInTheDocument()
})
