import { render, screen } from '@testing-library/react'
import { CreateMatchForm } from '@/app/(admin)/admin/match-events/CreateMatchForm'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

/**
 * Finding 5 from the whole-branch review: users.year_group is NOT NULL
 * DEFAULT 1 for every row, staff included, so a coach who plays (Joseph
 * Barton) showed a false "Y1" badge here — the same call site in
 * FormationBuilder already guards this with `role === 'student'`; this one
 * was missed.
 *
 * Both directions are asserted: a guard that hides the badge for EVERYONE
 * (rather than only non-students) would pass a "no badge for Joseph" test on
 * its own and would be an equally wrong fix.
 */
const TEAMS: never[] = []
const STUDENTS = [
  { id: 'p1', name: 'Alfie Casey', year_group: 2, role: 'student', team_id: null, teams: null },
  { id: 'p2', name: 'Joseph Barton', year_group: 1, role: 'coach', team_id: null, teams: null },
]

describe('CreateMatchForm — year badge role guard', () => {
  it('does not show a year badge for a non-student', () => {
    render(<CreateMatchForm students={STUDENTS as never} teams={TEAMS as never} coachId="c1" />)
    expect(screen.getByRole('button', { name: /Joseph Barton/ }).textContent).not.toMatch(/Y1|Y2/)
  })

  it('still shows a year badge for a student', () => {
    render(<CreateMatchForm students={STUDENTS as never} teams={TEAMS as never} coachId="c1" />)
    expect(screen.getByRole('button', { name: /Alfie Casey/ }).textContent).toContain('Y2')
  })
})
