import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { YearGroupSelect, RoleSelect } from '@/app/(admin)/admin/users/UserFields'

const updateUserYearGroupMock = jest.fn()
const updateUserRoleMock = jest.fn()

jest.mock('@/app/(admin)/admin/users/userActions', () => ({
  updateUserRole: (...a: any[]) => updateUserRoleMock(...a),
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

const year = () => screen.getByLabelText('Year group for Javan Moussa')

/**
 * The bug: these selects were uncontrolled and called their action in a bare
 * startTransition. A Server Action REJECTS rather than returning an error when
 * the request itself fails, and these actions also throw on a refused
 * permission — so the select kept displaying the value the user picked while
 * nothing had been saved, with no error. It silently claimed a change that
 * never happened.
 */
describe('a year group that fails to save', () => {
  beforeEach(() => {
    updateUserYearGroupMock.mockReset().mockResolvedValue(undefined)
    updateUserRoleMock.mockReset().mockResolvedValue(undefined)
  })

  it('keeps the new value when the save succeeds', async () => {
    render(<YearGroupSelect user={student()} />)
    fireEvent.change(year(), { target: { value: '2' } })

    await waitFor(() => expect(updateUserYearGroupMock).toHaveBeenCalledWith('s1', 2))
    expect(year()).toHaveValue('2')
    expect(screen.queryByText(/Not saved/)).not.toBeInTheDocument()
  })

  it('reverts to the previous value when the request fails', async () => {
    updateUserYearGroupMock.mockRejectedValue(new Error('offline'))
    render(<YearGroupSelect user={student()} />)
    fireEvent.change(year(), { target: { value: '2' } })

    await waitFor(() => expect(year()).toHaveValue('1'))
  })

  it('says so, rather than failing silently', async () => {
    updateUserYearGroupMock.mockRejectedValue(new Error('offline'))
    render(<YearGroupSelect user={student()} />)
    fireEvent.change(year(), { target: { value: '2' } })

    expect(await screen.findByText('Not saved — try again')).toBeInTheDocument()
  })

  it('reverts when the action throws a refusal, not just on a transport failure', async () => {
    updateUserYearGroupMock.mockRejectedValue(new Error('Year group applies to students only'))
    render(<YearGroupSelect user={student()} />)
    fireEvent.change(year(), { target: { value: '2' } })

    await waitFor(() => expect(year()).toHaveValue('1'))
    expect(screen.getByText('Not saved — try again')).toBeInTheDocument()
  })

  it('clears the error once a later change does save', async () => {
    updateUserYearGroupMock.mockRejectedValue(new Error('offline'))
    render(<YearGroupSelect user={student()} />)
    fireEvent.change(year(), { target: { value: '2' } })
    expect(await screen.findByText('Not saved — try again')).toBeInTheDocument()

    updateUserYearGroupMock.mockResolvedValue(undefined)
    fireEvent.change(year(), { target: { value: '2' } })
    await waitFor(() => expect(screen.queryByText('Not saved — try again')).not.toBeInTheDocument())
    expect(year()).toHaveValue('2')
  })

  it('starts from Year 1 when year_group is null rather than rendering blank', () => {
    render(<YearGroupSelect user={student({ year_group: null })} />)
    expect(year()).toHaveValue('1')
  })
})

describe('a role that fails to save', () => {
  beforeEach(() => {
    updateUserRoleMock.mockReset().mockResolvedValue(undefined)
  })

  const role = () => screen.getByLabelText('Role for Javan Moussa')

  it('reverts and reports, so a refused promotion cannot look like it worked', async () => {
    updateUserRoleMock.mockRejectedValue(new Error('Only an admin can grant staff roles'))
    render(<RoleSelect user={student()} />)
    fireEvent.change(role(), { target: { value: 'admin' } })

    await waitFor(() => expect(role()).toHaveValue('student'))
    expect(screen.getByText('Not saved — try again')).toBeInTheDocument()
  })

  it('keeps the new role when it saves', async () => {
    render(<RoleSelect user={student()} />)
    fireEvent.change(role(), { target: { value: 'coach' } })

    await waitFor(() => expect(updateUserRoleMock).toHaveBeenCalledWith('s1', 'coach'))
    expect(role()).toHaveValue('coach')
  })
})
