import { render, screen } from '@testing-library/react'

const rows = [
  { room_id: 'a', chat_rooms: { id: 'a', kind: 'parent', name: 'Parents', last_message_at: '2026-09-20T10:00:00Z' } },
  { room_id: 'b', chat_rooms: { id: 'b', kind: 'dm', name: 'Coach Dave', last_message_at: '2026-09-28T09:00:00Z' } },
  { room_id: 'c', chat_rooms: { id: 'c', kind: 'dm', name: 'Old chat', last_message_at: null } },
  { room_id: 'd', chat_rooms: { id: 'd', kind: 'squad', name: 'Not for parents', last_message_at: '2026-09-28T12:00:00Z' } },
]

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'parent-1' } } }) } }),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: rows }) }) }) }),
}))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))

import ParentMessagesPage from '@/app/(parent)/parent/messages/page'

it('lists parent chats newest message first, so a new message is at the top', async () => {
  render(await ParentMessagesPage())
  const names = screen.getAllByRole('link').map(a => a.textContent)
  expect(names[0]).toContain('Coach Dave')
  expect(names[1]).toContain('Parents')
  expect(names[2]).toContain('Old chat')
  expect(names).toHaveLength(3)
})
