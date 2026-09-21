import { render, screen, fireEvent, within } from '@testing-library/react'
import { UserCard } from '@/app/(admin)/admin/users/UserCard'
import { UserRow } from '@/app/(admin)/admin/users/UserRow'

const updateUserRoleMock = jest.fn()
const updateUserCourseMock = jest.fn()
const updateUserYearGroupMock = jest.fn()

jest.mock('@/app/(admin)/admin/users/userActions', () => ({
  updateUserRole: (...a: any[]) => updateUserRoleMock(...a),
  updateUserCourse: (...a: any[]) => updateUserCourseMock(...a),
  updateUserYearGroup: (...a: any[]) => updateUserYearGroupMock(...a),
}))

const COURSES = [{ id: 'c1', name: 'BTEC Sport' }]

function student(over: Record<string, unknown> = {}) {
  return {
    id: 's1', name: 'Javan Moussa', email: 'javanm@x.internal', role: 'student',
    course_id: null, created_at: '2026-09-10T11:02:14Z', year_group: 1, courses: null,
    ...over,
  } as any
}

describe('UserCard (phone layout)', () => {
  beforeEach(() => {
    updateUserRoleMock.mockReset()
    updateUserCourseMock.mockReset()
    updateUserYearGroupMock.mockReset()
  })

  it('shows the name and email', () => {
    render(<UserCard user={student()} courses={COURSES} />)
    expect(screen.getByRole('link', { name: /Javan Moussa/ })).toHaveAttribute('href', '/admin/students/s1')
    expect(screen.getByText('javanm@x.internal')).toBeInTheDocument()
  })

  it('changes the year group', () => {
    render(<UserCard user={student()} courses={COURSES} />)
    fireEvent.change(screen.getByLabelText('Year group for Javan Moussa'), { target: { value: '2' } })
    expect(updateUserYearGroupMock).toHaveBeenCalledWith('s1', 2)
  })

  it('changes the role', () => {
    render(<UserCard user={student()} courses={COURSES} />)
    fireEvent.change(screen.getByLabelText('Role for Javan Moussa'), { target: { value: 'coach' } })
    expect(updateUserRoleMock).toHaveBeenCalledWith('s1', 'coach')
  })

  it('changes the course', () => {
    render(<UserCard user={student()} courses={COURSES} />)
    fireEvent.change(screen.getByLabelText('Course for Javan Moussa'), { target: { value: 'c1' } })
    expect(updateUserCourseMock).toHaveBeenCalledWith('s1', 'c1')
  })

  it('shows no year picker for staff', () => {
    render(<UserCard user={student({ role: 'coach', name: 'Philippa L' })} courses={COURSES} />)
    expect(screen.queryByLabelText(/Year group for/)).not.toBeInTheDocument()
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
    const { container: card } = render(<UserCard user={student()} courses={COURSES} />)
    const { container: table } = render(
      <table><tbody><UserRow user={student()} courses={COURSES} /></tbody></table>
    )

    expect(controlLabels(card)).toEqual([
      'Course for Javan Moussa',
      'Role for Javan Moussa',
      'Year group for Javan Moussa',
    ])
    expect(controlLabels(card)).toEqual(controlLabels(table))
  })

  it('exposes the same controls for a staff account', () => {
    const coach = student({ role: 'coach', name: 'Philippa L' })
    const { container: card } = render(<UserCard user={coach} courses={COURSES} />)
    const { container: table } = render(
      <table><tbody><UserRow user={coach} courses={COURSES} /></tbody></table>
    )

    // No year picker for staff, in either layout.
    expect(controlLabels(card)).toEqual(['Course for Philippa L', 'Role for Philippa L'])
    expect(controlLabels(card)).toEqual(controlLabels(table))
  })
})
