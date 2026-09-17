import { render, screen, fireEvent } from '@testing-library/react'
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

  // Regression: this fix's own first pass just added Chat as a 9th icon to
  // an already-full row — cramped/unreadable on a real phone. Overflow
  // items now live behind a "More" toggle instead of growing the row.
  it('keeps only 4 primary tabs plus a More toggle in the always-visible row', () => {
    render(<BottomNav showTimetable showCoursework />)
    const nav = screen.getByText('Home').closest('nav')!
    const topLevelLinks = Array.from(nav.children).filter(el => el.tagName === 'A')
    expect(topLevelLinks.length).toBe(4)
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument()
  })

  it('reveals overflow items like Gym only after opening More', () => {
    render(<BottomNav />)
    expect(screen.getByText('Gym').closest('a')).toHaveAttribute('href', '/gym')
    // Present in the DOM (so it's testable/accessible) but tucked in the
    // closed sheet, not fighting for space in the primary row.
    const nav = screen.getByText('Home').closest('nav')!
    const topLevelLabels = Array.from(nav.children).filter(el => el.tagName === 'A').map(a => a.textContent)
    expect(topLevelLabels).not.toContain('Gym')

    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    expect(screen.getByRole('dialog', { name: /more/i })).toHaveAttribute('aria-hidden', 'false')
  })

  // Regression: the "More" sheet used to be a separate hand-written list
  // from SideNav's, and never got Nutrition/Moodle/Training/Matches/AI
  // Report added to it — students on phones had no way to reach any of
  // these pages at all, only desktop users did. Both navs now derive from
  // lib/nav/studentNav.ts's shared list.
  it('includes Nutrition, Training, GPS, Matches, and AI Report in the More sheet', () => {
    render(<BottomNav />)
    expect(screen.getByText('Nutrition').closest('a')).toHaveAttribute('href', '/nutrition')
    expect(screen.getByText('Training').closest('a')).toHaveAttribute('href', '/training')
    expect(screen.getByText('GPS').closest('a')).toHaveAttribute('href', '/gps')
    expect(screen.getByText('Matches').closest('a')).toHaveAttribute('href', '/matches')
    expect(screen.getByText('AI Report').closest('a')).toHaveAttribute('href', '/ai-report')
  })

  it('opens the external Moodle link in a new tab, not via client-side routing', () => {
    render(<BottomNav />)
    const moodleLink = screen.getByText('Moodle').closest('a')!
    expect(moodleLink).toHaveAttribute('target', '_blank')
    expect(moodleLink).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
