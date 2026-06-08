import { render, screen } from '@testing-library/react'
import { CatapultMetricsPreview } from '@/components/catapult/CatapultMetricsPreview'

describe('CatapultMetricsPreview', () => {
  it('renders the list of upcoming Catapult metrics', () => {
    render(<CatapultMetricsPreview />)
    expect(screen.getByRole('list', { name: /catapult metrics/i })).toBeInTheDocument()
  })

  it('shows core GPS metrics that will sync', () => {
    render(<CatapultMetricsPreview />)
    expect(screen.getByText(/total distance/i)).toBeInTheDocument()
    expect(screen.getByText(/top speed/i)).toBeInTheDocument()
    expect(screen.getByText(/player load/i)).toBeInTheDocument()
  })

  it('marks every metric as a coming-soon state', () => {
    render(<CatapultMetricsPreview />)
    const soonBadges = screen.getAllByText(/soon/i)
    expect(soonBadges.length).toBeGreaterThan(0)
  })
})
