import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MatchReport } from '@/app/(admin)/admin/match-events/[id]/MatchReport'

/**
 * Coverage for the missing "notify the squad when the match details
 * change" ask: date/kick-off/venue previously had no edit path in the
 * app at all. saveDetails() now updates match_events and, only when
 * something actually changed, pushes a notice to everyone who hasn't
 * declined (an "invited" player still deciding needs the change just as
 * much as one who's already accepted).
 */
const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const updateEq = jest.fn(() => Promise.resolve({ error: null }))
const update = jest.fn(() => ({ eq: updateEq }))
const from = jest.fn(() => ({ update }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from }) }))

const fetchMock = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
;(global as any).fetch = fetchMock

const match = {
  id: 'm1',
  match_date: '2026-10-01',
  kick_off_time: '18:00',
  opponent: 'Everton Academy',
  location: 'Prenton Park',
  notes: null,
  status: 'upcoming',
  home_score: null,
  away_score: null,
  motm_player_id: null,
  report_text: null,
  lessons_learned: null,
}

const squad = [
  { id: 's1', player_id: 'p1', status: 'accepted', position: null, coach_rating: null, coach_notes: null, goals: null, assists: null, minutes_played: null, yellow_card: false, red_card: false, users: { name: 'Alfie Casey', avatar_url: null, year_group: 1 } },
  { id: 's2', player_id: 'p2', status: 'invited', position: null, coach_rating: null, coach_notes: null, goals: null, assists: null, minutes_played: null, yellow_card: false, red_card: false, users: { name: 'Troy Lockyer', avatar_url: null, year_group: 2 } },
  { id: 's3', player_id: 'p3', status: 'declined', position: null, coach_rating: null, coach_notes: null, goals: null, assists: null, minutes_played: null, yellow_card: false, red_card: false, users: { name: 'Jack Roddick', avatar_url: null, year_group: 1 } },
]

describe('MatchReport — match details edit + notify', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    update.mockClear(); updateEq.mockClear(); from.mockClear()
    fetchMock.mockClear()
  })

  it('hides the save control until a detail actually changes', () => {
    render(<MatchReport match={match as any} squad={squad as any} />)
    expect(screen.queryByText('Save & notify squad')).not.toBeInTheDocument()
  })

  it('saves a changed venue and notifies accepted + invited players, not declined', async () => {
    render(<MatchReport match={match as any} squad={squad as any} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Prenton Park'), { target: { value: 'Central Park' } })
    fireEvent.click(screen.getByText('Save & notify squad'))

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ location: 'Central Park' })))
    expect(updateEq).toHaveBeenCalledWith('id', 'm1')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/push/send', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.targetUserIds.slice().sort()).toEqual(['p1', 'p2'])
    expect(body.title).toBe('Match update — vs Everton Academy')
    expect(body.body).toContain('Central Park')

    await waitFor(() => expect(screen.getByText(/Saved — 2 player\(s\) notified/)).toBeInTheDocument())
  })
})
