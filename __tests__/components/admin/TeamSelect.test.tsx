import { render, screen, fireEvent, within } from '@testing-library/react'
import { TeamSelect } from '@/app/(admin)/admin/users/UserFields'
import { UserRow } from '@/app/(admin)/admin/users/UserRow'
import { UserCard } from '@/app/(admin)/admin/users/UserCard'

const setUserTeamMock = jest.fn()

jest.mock('@/app/(admin)/admin/users/userActions', () => ({
  updateUserRole: jest.fn(async () => ({ ok: true })),
  updateUserCourse: jest.fn(async () => ({ ok: true })),
  updateUserYearGroup: jest.fn(async () => ({ ok: true })),
}))

jest.mock('@/app/(admin)/admin/teams/teamActions', () => ({
  setUserTeam: (...a: any[]) => setUserTeamMock(...a),
}))

const TEAMS = [
  { id: 't1', name: 'Prem', sort_order: 0, is_active: true },
  { id: 't2', name: 'White', sort_order: 1, is_active: true },
]

function user(over: Record<string, unknown> = {}) {
  return {
    id: 'u1', name: 'Joseph Barton', email: 'josephb@x.internal', role: 'coach',
    course_id: null, created_at: '2026-09-10T11:02:14Z', year_group: null, team_id: null, courses: null,
    ...over,
  } as any
}

describe('TeamSelect', () => {
  beforeEach(() => {
    setUserTeamMock.mockReset().mockResolvedValue({ ok: true })
  })

  // The coach-who-plays invariant: unlike YearGroupSelect (students-only),
  // TeamSelect has no role guard — a coach who plays needs a team too, and
  // having one is what makes someone pickable for a match squad.
  it('renders for a coach, not just a student', () => {
    render(<TeamSelect user={user({ role: 'coach' })} teams={TEAMS} />)
    expect(screen.getByLabelText('Team for Joseph Barton')).toBeInTheDocument()
  })

  it('renders for a student too', () => {
    render(<TeamSelect user={user({ role: 'student', name: 'Javan Moussa' })} teams={TEAMS} />)
    expect(screen.getByLabelText('Team for Javan Moussa')).toBeInTheDocument()
  })

  it('lists every active team plus a blank "No team" option', () => {
    render(<TeamSelect user={user()} teams={TEAMS} />)
    const select = screen.getByLabelText('Team for Joseph Barton')
    expect(within(select).getAllByRole('option').map(o => o.textContent)).toEqual([
      'No team', 'Prem', 'White',
    ])
  })

  it('calls setUserTeam with the userId and the chosen team id', () => {
    render(<TeamSelect user={user()} teams={TEAMS} />)
    fireEvent.change(screen.getByLabelText('Team for Joseph Barton'), { target: { value: 't2' } })
    expect(setUserTeamMock).toHaveBeenCalledWith('u1', 't2')
  })

  // NULL, not '', because team_id is a nullable FK — an empty string would be
  // a different (wrong) value to write to the database.
  it('calls setUserTeam with NULL, not an empty string, when the blank option is chosen', () => {
    render(<TeamSelect user={user({ team_id: 't1' })} teams={TEAMS} />)
    fireEvent.change(screen.getByLabelText('Team for Joseph Barton'), { target: { value: '' } })
    expect(setUserTeamMock).toHaveBeenCalledWith('u1', null)
    expect(setUserTeamMock).not.toHaveBeenCalledWith('u1', '')
  })

  // Finding 6 from the whole-branch review: the AI Coach is a real
  // public.users row (role='bot', migration 012). Giving it a team would make
  // it squad-eligible via ELIGIBLE_PLAYER_FILTER's team_id.not.is.null — it
  // must never be offered the control at all, not just discouraged from it.
  it('does not render a team select for a bot user', () => {
    render(<TeamSelect user={user({ role: 'bot', name: 'AI Coach' })} teams={TEAMS} />)
    expect(screen.queryByLabelText('Team for AI Coach')).not.toBeInTheDocument()
  })

  it('reverts to the previous value when the save is refused', async () => {
    setUserTeamMock.mockResolvedValue({ ok: false, error: 'Not saved — try again' })
    render(<TeamSelect user={user({ team_id: 't1' })} teams={TEAMS} />)
    const select = screen.getByLabelText('Team for Joseph Barton') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 't2' } })

    expect(await screen.findByText('Not saved — try again')).toBeInTheDocument()
    expect(select).toHaveValue('t1')
  })
})

/**
 * The regression guard this task exists for: a control added only to the
 * desktop UserRow was invisible on a phone (the year-group picker did this on
 * 2026-09-21). These assert TeamSelect is actually rendered inside BOTH
 * UserCard (the phone layout) and UserRow (the desktop layout), not merely
 * that the shared component works in isolation.
 */
describe('TeamSelect is present in both the mobile card and the desktop row', () => {
  it('renders inside UserCard, the phone layout', () => {
    render(<UserCard user={user()} courses={[]} teams={TEAMS} />)
    expect(screen.getByLabelText('Team for Joseph Barton')).toBeInTheDocument()
  })

  it('renders inside UserRow, the desktop layout', () => {
    render(<table><tbody><UserRow user={user()} courses={[]} teams={TEAMS} /></tbody></table>)
    expect(screen.getByLabelText('Team for Joseph Barton')).toBeInTheDocument()
  })

  it('renders inside UserCard for a coach specifically, mirroring the desktop row', () => {
    const coach = user({ role: 'coach', name: 'Philippa L' })
    render(<UserCard user={coach} courses={[]} teams={TEAMS} />)
    expect(screen.getByLabelText('Team for Philippa L')).toBeInTheDocument()
  })
})
