import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import type { CalendarEvent } from '@/lib/calendar/calendarUtils'

describe('CalendarGrid — event type', () => {
  const events: CalendarEvent[] = [
    { date: '2024-06-12', label: "Parents' evening", type: 'event', time: '6:30pm', description: 'Main hall' },
  ]

  it('shows the event in the legend', () => {
    render(<CalendarGrid events={events} initialYear={2024} initialMonth={6} />)
    expect(screen.getByText('Event')).toBeInTheDocument()
  })

  it('shows the event, its time and description in the day panel when the day is selected', () => {
    render(<CalendarGrid events={events} initialYear={2024} initialMonth={6} />)
    fireEvent.click(screen.getByRole('button', { name: /12.*1 event/i }))
    expect(screen.getByText("Parents' evening")).toBeInTheDocument()
    expect(screen.getByText('6:30pm')).toBeInTheDocument()
    expect(screen.getByText('Main hall')).toBeInTheDocument()
  })

  it('does not show time/description text for a day with no events selected', () => {
    render(<CalendarGrid events={events} initialYear={2024} initialMonth={6} />)
    expect(screen.queryByText('Main hall')).not.toBeInTheDocument()
  })
})

describe('CalendarGrid — class event type', () => {
  const events: CalendarEvent[] = [
    { date: '2024-06-12', label: 'Football 1', type: 'class', time: '10am', description: 'Pitch 1' },
  ]

  it('shows the class type in the legend', () => {
    render(<CalendarGrid events={events} initialYear={2024} initialMonth={6} />)
    expect(screen.getByText('Class')).toBeInTheDocument()
  })
})
