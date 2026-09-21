import { render, screen, fireEvent } from '@testing-library/react'
import { UserRow } from '@/app/(admin)/admin/users/UserRow'

const updateUserYearGroupMock = jest.fn()
jest.mock('@/app/(admin)/admin/users/userActions', () => ({
  updateUserRole: jest.fn(),
  updateUserCourse: jest.fn(),
  updateUserYearGroup: (...a: any[]) => updateUserYearGroupMock(...a),
}))

function student(over: Record<string, unknown> = {}) {
  return {
    id: 's1', name: 'Javan Moussa', email: 'javanm@x.internal', role: 'student',
    course_id: null, created_at: '2026-09-10T11:02:14Z', year_group: 1, courses: null,
    ...over,
  } as any
}

function renderRow(user: any) {
  return render(<table><tbody><UserRow user={user} courses={[]} /></tbody></table>)
}

describe('UserRow year group', () => {
  beforeEach(() => updateUserYearGroupMock.mockReset())

  it('shows a year picker for a student, set to their current year', () => {
    renderRow(student())
    expect(screen.getByLabelText('Year group for Javan Moussa')).toHaveValue('1')
  })

  it('reflects a Year 2 student', () => {
    renderRow(student({ year_group: 2 }))
    expect(screen.getByLabelText('Year group for Javan Moussa')).toHaveValue('2')
  })

  it('saves the new year group when changed', () => {
    renderRow(student())
    fireEvent.change(screen.getByLabelText('Year group for Javan Moussa'), { target: { value: '2' } })
    expect(updateUserYearGroupMock).toHaveBeenCalledWith('s1', 2)
  })

  it('falls back to Year 1 when year_group is null rather than rendering blank', () => {
    renderRow(student({ year_group: null }))
    expect(screen.getByLabelText('Year group for Javan Moussa')).toHaveValue('1')
  })

  it('shows no year picker for staff', () => {
    renderRow(student({ role: 'coach', name: 'Philippa L' }))
    expect(screen.queryByLabelText(/Year group for/)).not.toBeInTheDocument()
  })
})
