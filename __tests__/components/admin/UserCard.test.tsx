import { render, screen, fireEvent, within } from '@testing-library/react'
import { UserCard } from '@/app/(admin)/admin/users/UserCard'
import { UserRow } from '@/app/(admin)/admin/users/UserRow'

const updateUserRoleMock = jest.fn()
const updateUserCourseMock = jest.fn()
const updateUserYearGroupMock = jest.fn()
const setUserTeamMock = jest.fn()

jest.mock('@/app/(admin)/admin/users/userActions', () => ({
  updateUserRole: (...a: any[]) => updateUserRoleMock(...a),
  updateUserCourse: (...a: any[]) => updateUserCourseMock(...a),
  updateUserYearGroup: (...a: any[]) => updateUserYearGroupMock(...a),
}))

jest.mock('@/app/(admin)/admin/teams/teamActions', () => ({
  setUserTeam: (...a: any[]) => setUserTeamMock(...a),
}))

const COURSES = [{ id: 'c1', name: 'BTEC Sport' }]
const TEAMS = [{ id: 't1', name: 'Prem', sort_order: 0, is_active: true }]

function student(over: Record<string, unknown> = {}) {
  return {
    id: 's1', name: 'Javan Moussa', email: 'javanm@x.internal', role: 'student',
    course_id: null, created_at: '2026-09-10T11:02:14Z', year_group: 1, team_id: null, courses: null,
    ...over,
  } as any
}

describe('UserCard (phone layout)', () => {
  beforeEach(() => {
    updateUserRoleMock.mockReset().mockResolvedValue({ ok: true })
    updateUserCourseMock.mockReset().mockResolvedValue({ ok: true })
    updateUserYearGroupMock.mockReset().mockResolvedValue({ ok: true })
    setUserTeamMock.mockReset().mockResolvedValue({ ok: true })
  })

  it('shows the name and email', () => {
    render(<UserCard user={student()} courses={COURSES} teams={TEAMS} />)
    expect(screen.getByRole('link', { name: /Javan Moussa/ })).toHaveAttribute('href', '/admin/students/s1')
    expect(screen.getByText('javanm@x.internal')).toBeInTheDocument()
  })

  it('changes the year group', () => {
    render(<UserCard user={student()} courses={COURSES} teams={TEAMS} />)
    fireEvent.change(screen.getByLabelText('Year group for Javan Moussa'), { target: { value: '2' } })
    expect(updateUserYearGroupMock).toHaveBeenCalledWith('s1', 2)
  })

  it('changes the role', () => {
    render(<UserCard user={student()} courses={COURSES} teams={TEAMS} />)
    fireEvent.change(screen.getByLabelText('Role for Javan Moussa'), { target: { value: 'coach' } })
    expect(updateUserRoleMock).toHaveBeenCalledWith('s1', 'coach')
  })

  it('changes the course', () => {
    render(<UserCard user={student()} courses={COURSES} teams={TEAMS} />)
    fireEvent.change(screen.getByLabelText('Course for Javan Moussa'), { target: { value: 'c1' } })
    expect(updateUserCourseMock).toHaveBeenCalledWith('s1', 'c1')
  })

  it('shows no year picker for staff', () => {
    render(<UserCard user={student({ role: 'coach', name: 'Philippa L' })} courses={COURSES} teams={TEAMS} />)
    expect(screen.queryByLabelText(/Year group for/)).not.toBeInTheDocument()
  })

  // The coach-who-plays invariant: unlike YearGroupSelect, the Team control
  // must render (and be usable) for every role, not just students.
  it('shows a team picker for a coach, in the mobile card', () => {
    render(<UserCard user={student({ role: 'coach', name: 'Philippa L' })} courses={COURSES} teams={TEAMS} />)
    expect(screen.getByLabelText('Team for Philippa L')).toBeInTheDocument()
  })

  it('changes the team, in the mobile card', () => {
    render(<UserCard user={student()} courses={COURSES} teams={TEAMS} />)
    fireEvent.change(screen.getByLabelText('Team for Javan Moussa'), { target: { value: 't1' } })
    expect(setUserTeamMock).toHaveBeenCalledWith('s1', 't1')
  })

  it('unassigns with NULL, not an empty string, when the blank option is chosen', () => {
    render(<UserCard user={student({ team_id: 't1' })} courses={COURSES} teams={TEAMS} />)
    fireEvent.change(screen.getByLabelText('Team for Javan Moussa'), { target: { value: '' } })
    expect(setUserTeamMock).toHaveBeenCalledWith('s1', null)
  })
})

/**
 * The bug this whole change exists to fix was a control that shipped in one
 * layout and was unreachable in the other. These assert the two layouts expose
 * the SAME controls, so a field added to one and forgotten in the other fails
 * here rather than in someone's hands on a phone.
 */
describe('phone and desktop layouts stay in parity', () => {
  function controlLabels(container: HTMLElement) {
    return within(container)
      .queryAllByRole('combobox')
      .map(el => el.getAttribute('aria-label'))
      .sort()
  }

  it('exposes the same controls for a student', () => {
    const { container: card } = render(<UserCard user={student()} courses={COURSES} teams={TEAMS} />)
    const { container: table } = render(
      <table><tbody><UserRow user={student()} courses={COURSES} teams={TEAMS} /></tbody></table>
    )

    expect(controlLabels(card)).toEqual([
      'Course for Javan Moussa',
      'Role for Javan Moussa',
      'Team for Javan Moussa',
      'Year group for Javan Moussa',
    ])
    expect(controlLabels(card)).toEqual(controlLabels(table))
  })

  it('exposes the same controls for a staff account, INCLUDING Team', () => {
    const coach = student({ role: 'coach', name: 'Philippa L' })
    const { container: card } = render(<UserCard user={coach} courses={COURSES} teams={TEAMS} />)
    const { container: table } = render(
      <table><tbody><UserRow user={coach} courses={COURSES} teams={TEAMS} /></tbody></table>
    )

    // No year picker for staff, in either layout — but Team is NOT
    // students-only, unlike YearGroupSelect, so it still appears.
    expect(controlLabels(card)).toEqual([
      'Course for Philippa L',
      'Role for Philippa L',
      'Team for Philippa L',
    ])
    expect(controlLabels(card)).toEqual(controlLabels(table))
  })
})
