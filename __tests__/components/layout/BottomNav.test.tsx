import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/layout/BottomNav'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))

beforeEach(() => {
  (usePathname as jest.Mock).mockReturnValue('/dashboard')
})

describe('BottomNav', () => {
  it('does not show Timetable by default', () => {
    render(<BottomNav />)
    expect(screen.queryByText('Timetable')).not.toBeInTheDocument()
  })

  it('shows Timetable when showTimetable is true', () => {
    render(<BottomNav showTimetable />)
    expect(screen.getByText('Timetable')).toBeInTheDocument()
  })

  // Regression: Chat was dropped from the mobile bottom nav on 2026-06-08
  // ("add calendar, gym, targets to student bottom nav") and stayed missing
  // for three months — students on phones had no way to reach /chat.
  it('always shows a Chat link to /chat', () => {
    render(<BottomNav />)
    const chatLink = screen.getByText('Chat').closest('a')
    expect(chatLink).toHaveAttribute('href', '/chat')
  })
})
