import { render, screen } from '@testing-library/react'
import { WellbeingPromptCard } from '@/components/wellbeing/WellbeingPromptCard'

describe('WellbeingPromptCard', () => {
  it('renders a link to /wellbeing', () => {
    render(<WellbeingPromptCard />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/wellbeing')
  })

  it('mentions wellbeing in the visible text', () => {
    render(<WellbeingPromptCard />)
    expect(screen.getAllByText(/wellbeing/i).length).toBeGreaterThan(0)
  })

  it('has a call-to-action prompt for the survey', () => {
    render(<WellbeingPromptCard />)
    expect(screen.getAllByText(/survey|complete|check.?in/i).length).toBeGreaterThan(0)
  })
})
