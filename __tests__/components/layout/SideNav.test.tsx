import { render, screen, within } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { SideNav } from '@/components/layout/SideNav'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))
jest.mock('@/app/(auth)/login/actions', () => ({ signOut: jest.fn() }))

beforeEach(() => {
  (usePathname as jest.Mock).mockReturnValue('/dashboard')
})

describe('SideNav', () => {
  it('does not show Timetable by default', () => {
    render(<SideNav userName="Test Player" avatarUrl={null} role="student" />)
    expect(screen.queryByText('Timetable')).not.toBeInTheDocument()
  })

  it('shows Timetable when showTimetable is true', () => {
    render(<SideNav userName="Test Player" avatarUrl={null} role="student" showTimetable />)
    expect(screen.getByText('Timetable')).toBeInTheDocument()
  })

  // Confirmed live 2026-09-10: with the full student nav list (up to 12
  // items — Timetable/Coursework, GPS, etc. all shown), the sidebar grew
  // taller than the viewport on a shorter desktop window. The layout root
  // clips overflow (see app/(student)/layout.tsx), so "Sign Out" — the
  // very last element, after the whole nav list — was pushed off-screen
  // with no scrollbar to reach it. AdminSidebar already scrolls its own
  // nav list internally for exactly this reason; SideNav never did.
  it('scrolls the nav list internally, so Sign Out stays reachable regardless of list length', () => {
    render(<SideNav userName="Test Player" avatarUrl={null} role="student" showTimetable showCoursework />)
    const nav = screen.getByRole('navigation')
    expect(nav.className).toContain('overflow-y-auto')
    expect(within(nav).queryByText('Sign Out')).not.toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  // Regression: SideNav's list used to be a separate hand-written array
  // from BottomNav's, and never got Calendar/Gym/Targets/Wellbeing added
  // to it — desktop students had no sidebar link to any of these pages,
  // only mobile users did. Both navs now derive from lib/nav/studentNav.ts.
  it('includes Calendar, Gym, Targets, and Wellbeing links', () => {
    render(<SideNav userName="Test Player" avatarUrl={null} role="student" />)
    expect(screen.getByText('Calendar').closest('a')).toHaveAttribute('href', '/calendar')
    expect(screen.getByText('Gym').closest('a')).toHaveAttribute('href', '/gym')
    expect(screen.getByText('Targets').closest('a')).toHaveAttribute('href', '/targets')
    expect(screen.getByText('Wellbeing').closest('a')).toHaveAttribute('href', '/wellbeing')
  })
})
