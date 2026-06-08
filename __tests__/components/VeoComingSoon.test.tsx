import { render, screen } from '@testing-library/react'
import { VeoComingSoon } from '@/components/VeoComingSoon'

describe('VeoComingSoon', () => {
  it('renders a coming-soon heading for clips', () => {
    render(<VeoComingSoon />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('explains that clips appear once VEO is connected', () => {
    render(<VeoComingSoon />)
    expect(screen.getByText(/VEO connection is live/i)).toBeInTheDocument()
  })

  it('does not present an active video player or link', () => {
    render(<VeoComingSoon />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
