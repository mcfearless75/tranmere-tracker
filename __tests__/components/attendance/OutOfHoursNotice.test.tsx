import { render, screen } from '@testing-library/react'
import { OutOfHoursNotice } from '@/components/attendance/OutOfHoursNotice'
import type { PhaseWindows } from '@/lib/attendance/phase'

const WINDOWS: PhaseWindows = {
  am:    { start: '00:00:00', end: '11:00:00' },
  lunch: { start: '11:00:00', end: '13:30:00' },
  pm:    { start: '14:30:00', end: '23:59:00' },
}

describe('OutOfHoursNotice', () => {
  it('tells a student in the lunch-to-pm gap exactly when scan-out opens', () => {
    render(<OutOfHoursNotice next="pm" windows={WINDOWS} />)
    expect(screen.getByText('Too early to scan out')).toBeInTheDocument()
    expect(screen.getByText('Scan-out opens at 14:30')).toBeInTheDocument()
    expect(screen.getByTestId('out-of-hours')).toHaveTextContent('Nothing’s been recorded yet'.replace('’', "'"))
    expect(screen.getByTestId('out-of-hours')).toHaveTextContent('streak')
    expect(screen.queryByText(/Out of hours/)).not.toBeInTheDocument()
  })

  it('names the lunch window when that is next', () => {
    render(<OutOfHoursNotice next="lunch" windows={WINDOWS} />)
    expect(screen.getByText('Lunch check-in opens at 11:00')).toBeInTheDocument()
    expect(screen.getByTestId('out-of-hours')).not.toHaveTextContent('streak')
  })

  it('says closed for the day when nothing else opens', () => {
    render(<OutOfHoursNotice next={null} windows={WINDOWS} />)
    expect(screen.getByText('Check-in’s closed for today'.replace('’', "'"))).toBeInTheDocument()
    expect(screen.getByTestId('out-of-hours')).toHaveTextContent('Scan-out closed at 23:59')
  })
})
