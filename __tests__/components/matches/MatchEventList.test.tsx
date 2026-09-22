import { render, screen } from '@testing-library/react'
import { MatchEventList } from '@/app/(admin)/admin/match-events/MatchEventList'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

/**
 * Finding 3 from the whole-branch review: a fixture's team was invisible
 * after creation — nothing on this list said which team a match belonged
 * to, so a coach had no way to notice a wrong pick without opening the
 * fixture's edit form.
 */
function match(over: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    match_date: '2099-01-01',
    kick_off_time: '18:00',
    opponent: 'Everton Academy',
    location: 'Prenton Park',
    status: 'upcoming',
    notes: null,
    team_id: null,
    teams: null,
    match_squads: [],
    ...over,
  }
}

describe('MatchEventList — team badge', () => {
  it('shows the team name for a fixture that has one', () => {
    render(<MatchEventList matches={[match({ team_id: 't-prem', teams: { id: 't-prem', name: 'Prem' } })] as never} />)
    expect(screen.getByText('Prem')).toBeInTheDocument()
  })

  it('shows no team badge for a fixture with no team', () => {
    render(<MatchEventList matches={[match()] as never} />)
    expect(screen.queryByTitle(/team$/)).not.toBeInTheDocument()
  })
})
