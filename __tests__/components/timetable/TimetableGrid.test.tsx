import { render, screen } from '@testing-library/react'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'
import type { TimetableSlotRow } from '@/lib/timetable/timetableUtils'

describe('TimetableGrid', () => {
  it('shows a match-day card for Wednesday', () => {
    render(<TimetableGrid slots={[]} />)
    expect(screen.getByText('⚽ Match day — no timetable')).toBeInTheDocument()
  })

  it('renders a session under its day with time, location and tutor', () => {
    const slots: TimetableSlotRow[] = [
      {
        id: '1', year_group: 1, day_of_week: 1,
        start_time: '11:00:00', end_time: '12:30:00',
        title: 'Football 1', location: 'Tranmere Pitch 1', tutor: 'Chaid White',
      },
    ]
    render(<TimetableGrid slots={slots} />)
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Football 1')).toBeInTheDocument()
    expect(screen.getByText('11:00–12:30 · Tranmere Pitch 1 · Chaid White')).toBeInTheDocument()
  })

  it('shows a placeholder for a weekday with nothing scheduled', () => {
    render(<TimetableGrid slots={[]} />)
    expect(screen.getAllByText('Nothing scheduled.').length).toBe(4) // Mon, Tue, Thu, Fri
  })
})
