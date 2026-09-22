import { render, screen } from '@testing-library/react'
import { TeamBadge } from '@/components/TeamBadge'

describe('TeamBadge', () => {
  it('renders the team name', () => {
    render(<TeamBadge team={{ id: 'a1', name: 'Prem' }} />)
    expect(screen.getByText('Prem')).toBeInTheDocument()
  })

  it('renders nothing when the player has no team', () => {
    const { container } = render(<TeamBadge team={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('gives the same team the same colour every time', () => {
    const { container: a } = render(<TeamBadge team={{ id: 'a1', name: 'Prem' }} />)
    const { container: b } = render(<TeamBadge team={{ id: 'a1', name: 'Renamed' }} />)
    expect(a.firstElementChild?.className).toBe(b.firstElementChild?.className)
  })
})
