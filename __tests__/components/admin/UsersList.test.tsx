import { render, screen, fireEvent, within } from '@testing-library/react'
import { UsersList } from '@/app/(admin)/admin/users/UsersList'

jest.mock('@/app/(admin)/admin/users/userActions', () => ({
  updateUserRole: jest.fn(),
  updateUserCourse: jest.fn(),
  updateUserYearGroup: jest.fn(),
}))

const COURSES = [{ id: 'c1', name: 'BTEC Sport' }]

function user(over: Record<string, unknown> = {}) {
  return {
    id: 'u1', name: 'Javan Moussa', email: 'javanm@x.internal', role: 'student',
    course_id: null, created_at: '2026-09-10T11:02:14Z', year_group: 1, courses: null,
    ...over,
  } as any
}

const USERS = [
  user(),
  user({ id: 'u2', name: 'Caleb McWilliam', email: 'calebm@x.internal' }),
  user({ id: 'u3', name: 'Philippa Lomax', email: 'philippal@x.internal', role: 'coach' }),
]

function renderList(users = USERS) {
  return render(<UsersList users={users} courses={COURSES} />)
}

/**
 * Both layouts render at once (CSS decides which is visible), so every user
 * appears twice in the DOM. Assert on the phone card list to count once.
 */
function cardNames() {
  const cards = document.querySelector('.sm\\:hidden') as HTMLElement
  return within(cards).queryAllByRole('link').map(a => a.textContent?.trim())
}

function search(text: string) {
  fireEvent.change(screen.getByLabelText('Search users by name or email'), { target: { value: text } })
}

describe('UsersList search', () => {
  it('lists everyone when the box is empty', () => {
    renderList()
    expect(cardNames()).toEqual(['Javan Moussa', 'Caleb McWilliam', 'Philippa Lomax'])
  })

  it('shows no count line until you search', () => {
    renderList()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('filters by name', () => {
    renderList()
    search('caleb')
    expect(cardNames()).toEqual(['Caleb McWilliam'])
  })

  it('filters by email', () => {
    renderList()
    search('philippal@')
    expect(cardNames()).toEqual(['Philippa Lomax'])
  })

  it('is case-insensitive', () => {
    renderList()
    search('JAVAN')
    expect(cardNames()).toEqual(['Javan Moussa'])
  })

  it('matches a surname, not just the start of the name', () => {
    renderList()
    search('moussa')
    expect(cardNames()).toEqual(['Javan Moussa'])
  })

  it('ignores surrounding whitespace', () => {
    renderList()
    search('   caleb   ')
    expect(cardNames()).toEqual(['Caleb McWilliam'])
  })

  it('reports how many of the total are showing', () => {
    renderList()
    search('a')
    expect(screen.getByRole('status')).toHaveTextContent('Showing 3 of 3')
    search('caleb')
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 3')
  })

  // Deliberate: matching role would make "Stu" surface every student as well
  // as Stuart, which is worse than no filter.
  it('does not match on role', () => {
    renderList()
    search('coach')
    expect(cardNames()).toEqual([])
  })

  it('distinguishes "nothing matched" from "no users at all"', () => {
    renderList()
    search('zzzz')
    expect(screen.getAllByText(/No users match “zzzz”/).length).toBeGreaterThan(0)
    expect(screen.queryByText('No users yet.')).not.toBeInTheDocument()
  })

  it('says the roster is empty when it actually is', () => {
    renderList([])
    expect(screen.getAllByText('No users yet.').length).toBeGreaterThan(0)
  })

  it('clears the search and restores everyone', () => {
    renderList()
    search('caleb')
    expect(cardNames()).toEqual(['Caleb McWilliam'])

    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(cardNames()).toEqual(['Javan Moussa', 'Caleb McWilliam', 'Philippa Lomax'])
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })

  it('offers no clear button until there is something to clear', () => {
    renderList()
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })

  it('keeps the per-user controls working on a filtered row', () => {
    renderList()
    search('caleb')
    expect(screen.getAllByLabelText('Year group for Caleb McWilliam').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Role for Caleb McWilliam').length).toBeGreaterThan(0)
  })
})
