import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MatchEditForm } from '@/app/(admin)/admin/match-events/[id]/MatchEditForm'

/**
 * Finding 3 from the whole-branch review: a match's team was write-once
 * (only CreateMatchForm ever wrote match_events.team_id) and invisible after
 * creation. The only fix for a wrong pick was deleting and re-creating the
 * fixture, which drops match_squads and re-sends every squad-invite push.
 * MatchEditForm now carries a Team field alongside the other editable ones.
 */
const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const updateEq = jest.fn(() => Promise.resolve({ error: null }))
const update = jest.fn(() => ({ eq: updateEq }))
const from = jest.fn(() => ({ update }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from }) }))

const TEAMS = [
  { id: 't-prem', name: 'Prem', sort_order: 0, is_active: true },
  { id: 't-blue', name: 'Blue', sort_order: 2, is_active: true },
]

const match = {
  id: 'm1',
  match_date: '2026-10-01',
  kick_off_time: '18:00',
  meet_time: '17:30',
  opponent: 'Everton Academy',
  location: 'Prenton Park',
  notes: null,
  status: 'upcoming',
  team_id: 't-prem' as string | null,
}

describe('MatchEditForm — team field', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    update.mockClear(); updateEq.mockClear(); from.mockClear()
  })

  it('pre-selects the fixture\'s current team', () => {
    render(<MatchEditForm match={match} teams={TEAMS} />)
    expect(screen.getByLabelText('Team')).toHaveValue('t-prem')
  })

  it('shows "No team" when the fixture has none', () => {
    render(<MatchEditForm match={{ ...match, team_id: null }} teams={TEAMS} />)
    expect(screen.getByLabelText('Team')).toHaveValue('')
  })

  it('saves the newly chosen team_id when the team is changed', async () => {
    render(<MatchEditForm match={match} teams={TEAMS} />)

    fireEvent.change(screen.getByLabelText('Team'), { target: { value: 't-blue' } })
    fireEvent.click(screen.getByText('Save changes'))

    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: 't-blue' })
    ))
  })

  // NULL, not '', because team_id is a nullable FK — an empty string would be
  // a different (wrong) value to write to the database, and is exactly the
  // kind of thing a hand-rolled `teamId || null` guard is easy to get wrong.
  it('sends null, not an empty string, when the team is cleared', async () => {
    render(<MatchEditForm match={match} teams={TEAMS} />)

    fireEvent.change(screen.getByLabelText('Team'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Save changes'))

    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: null })
    ))
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ team_id: '' }))
  })
})
