import { render, screen } from '@testing-library/react'
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
})
