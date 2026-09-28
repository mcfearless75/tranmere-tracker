import { render, screen } from '@testing-library/react'
import { StreakCard, streakMessage } from '@/components/attendance/StreakCard'

describe('streakMessage', () => {
  it('nudges a live streak that still needs today', () => {
    expect(streakMessage({ current: 3, best: 3, todayDone: false })).toBe('Scan in and out today to make it 4.')
  })

  it('celebrates a finished day', () => {
    expect(streakMessage({ current: 2, best: 2, todayDone: true })).toMatch(/in the bag/)
    expect(streakMessage({ current: 7, best: 7, todayDone: true })).toMatch(/^7 days straight/)
  })

  it('points a broken streak at the best so far', () => {
    expect(streakMessage({ current: 0, best: 5, todayDone: false })).toBe('Your best is 5. Scan in and out today to start again.')
  })

  it('invites a first streak', () => {
    expect(streakMessage({ current: 0, best: 0, todayDone: false })).toBe('Scan in and out today to start your streak.')
  })
})

describe('StreakCard', () => {
  it('shows the count and best when best is higher', () => {
    render(<StreakCard streak={{ current: 1, best: 4, todayDone: false }} />)
    expect(screen.getByTestId('streak-card')).toHaveTextContent('1-day streak')
    expect(screen.getByText('Best: 4')).toBeInTheDocument()
  })

  it('hides best when the current streak is the best', () => {
    render(<StreakCard streak={{ current: 4, best: 4, todayDone: true }} />)
    expect(screen.queryByText(/Best:/)).not.toBeInTheDocument()
  })
})
