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
})
