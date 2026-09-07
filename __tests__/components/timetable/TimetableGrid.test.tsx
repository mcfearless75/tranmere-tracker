import { render, screen } from '@testing-library/react'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'
import type { TimetableSlotRow } from '@/lib/timetable/timetableUtils'

describe('TimetableGrid', () => {
  it('shows a match-day badge and empty-state copy for Wednesday when nothing is scheduled', () => {
    render(<TimetableGrid slots={[]} />)
    expect(screen.getByText('⚽ Match day')).toBeInTheDocument()
    expect(screen.getByText('No timetable — match day.')).toBeInTheDocument()
  })

  it('still shows the match-day badge alongside a real Wednesday session', () => {
    const slots: TimetableSlotRow[] = [
      {
        id: '1', year_group: 1, day_of_week: 3,
        start_time: '09:00:00', end_time: '10:00:00',
        title: 'GCSE English Facilitation', location: 'Rm2', tutor: 'RF',
      },
    ]
    render(<TimetableGrid slots={slots} />)
    expect(screen.getByText('⚽ Match day')).toBeInTheDocument()
    expect(screen.getByText('GCSE English Facilitation')).toBeInTheDocument()
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
