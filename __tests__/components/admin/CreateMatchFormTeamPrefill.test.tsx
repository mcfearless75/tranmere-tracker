import { render, screen, fireEvent } from '@testing-library/react'
import { CreateMatchForm } from '@/app/(admin)/admin/match-events/CreateMatchForm'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

const TEAMS = [
  { id: 't-prem', name: 'Prem', sort_order: 0, is_active: true },
  { id: 't-blue', name: 'Blue', sort_order: 2, is_active: true },
]
const STUDENTS = [
  { id: 'p1', name: 'Alfie Casey', year_group: 2, role: 'student', team_id: 't-prem', teams: { id: 't-prem', name: 'Prem' } },
  { id: 'p2', name: 'Lewis Boden', year_group: 1, role: 'student', team_id: 't-blue', teams: { id: 't-blue', name: 'Blue' } },
  { id: 'p3', name: 'Khalid Eletu', year_group: 2, role: 'student', team_id: null, teams: null },
]

function setup() {
  render(<CreateMatchForm students={STUDENTS as never} teams={TEAMS as never} coachId="c1" />)
}

describe('CreateMatchForm team pre-fill', () => {
  it('pre-ticks exactly the chosen team, and nobody else', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/team/i), { target: { value: 't-prem' } })
    expect((screen.getByRole('button', { name: /Alfie Casey/ })).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByRole('button', { name: /Lewis Boden/ })).getAttribute('aria-pressed')).toBe('false')
    expect((screen.getByRole('button', { name: /Khalid Eletu/ })).getAttribute('aria-pressed')).toBe('false')
  })

  it('clears the selection when the team is unset', () => {
    setup()
    const picker = screen.getByLabelText(/team/i)
    fireEvent.change(picker, { target: { value: 't-prem' } })
    fireEvent.change(picker, { target: { value: '' } })
    expect((screen.getByRole('button', { name: /Alfie Casey/ })).getAttribute('aria-pressed')).toBe('false')
  })

  it('still lets a player from another team be called up', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/team/i), { target: { value: 't-prem' } })
    fireEvent.click(screen.getByRole('button', { name: /Lewis Boden/ }))
    expect((screen.getByRole('button', { name: /Lewis Boden/ })).getAttribute('aria-pressed')).toBe('true')
  })

  it('does not discard manual picks when the coach declines to switch teams', () => {
    setup()
    // Manually tick a player with no team selected yet (teamId === '').
    fireEvent.click(screen.getByRole('button', { name: /Khalid Eletu/ }))
    expect((screen.getByRole('button', { name: /Khalid Eletu/ })).getAttribute('aria-pressed')).toBe('true')

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    const picker = screen.getByLabelText(/team/i) as HTMLSelectElement
    fireEvent.change(picker, { target: { value: 't-prem' } })

    // Declined: manual selection must survive, AND the picker must not have moved.
    expect(confirmSpy).toHaveBeenCalled()
    expect((screen.getByRole('button', { name: /Khalid Eletu/ })).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByRole('button', { name: /Alfie Casey/ })).getAttribute('aria-pressed')).toBe('false')
    expect((screen.getByLabelText(/team/i) as HTMLSelectElement).value).toBe('')

    confirmSpy.mockRestore()
  })

  it('does NOT ask to confirm switching from an untouched team to another team', () => {
    setup()
    const picker = screen.getByLabelText(/team/i) as HTMLSelectElement
    fireEvent.change(picker, { target: { value: 't-prem' } })
    // No manual edits made — selection is exactly Prem's roster.

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.change(picker, { target: { value: 't-blue' } })

    // Nothing manual to lose, so no prompt — and the switch must go through.
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(picker.value).toBe('t-blue')
    expect((screen.getByRole('button', { name: /Alfie Casey/ })).getAttribute('aria-pressed')).toBe('false')
    expect((screen.getByRole('button', { name: /Lewis Boden/ })).getAttribute('aria-pressed')).toBe('true')

    confirmSpy.mockRestore()
  })

  it('confirms before replacing an edited team selection with a different team, and applies the switch when accepted', () => {
    setup()
    const picker = screen.getByLabelText(/team/i) as HTMLSelectElement
    fireEvent.change(picker, { target: { value: 't-prem' } })
    // Edit: call up Lewis (from Blue) on top of Prem's pre-filled roster —
    // the selection ({p1, p2}) no longer equals prefillFor('t-prem') ({p1}).
    fireEvent.click(screen.getByRole('button', { name: /Lewis Boden/ }))
    expect((screen.getByRole('button', { name: /Lewis Boden/ })).getAttribute('aria-pressed')).toBe('true')

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.change(picker, { target: { value: 't-blue' } })

    expect(confirmSpy).toHaveBeenCalled()
    expect(picker.value).toBe('t-blue')
    expect((screen.getByRole('button', { name: /Alfie Casey/ })).getAttribute('aria-pressed')).toBe('false')
    expect((screen.getByRole('button', { name: /Lewis Boden/ })).getAttribute('aria-pressed')).toBe('true')

    confirmSpy.mockRestore()
  })

  it('confirms before replacing an edited team selection with a different team, and leaves both untouched when declined', () => {
    setup()
    const picker = screen.getByLabelText(/team/i) as HTMLSelectElement
    fireEvent.change(picker, { target: { value: 't-prem' } })
    // Same edit as above: call up Lewis on top of Prem's roster.
    fireEvent.click(screen.getByRole('button', { name: /Lewis Boden/ }))

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.change(picker, { target: { value: 't-blue' } })

    // Declined: the dropdown must not have moved, and both the team roster
    // and the manual call-up must survive intact — a half-applied state
    // (dropdown moved but selection didn't, or vice versa) is the bug.
    expect(confirmSpy).toHaveBeenCalled()
    expect(picker.value).toBe('t-prem')
    expect((screen.getByRole('button', { name: /Alfie Casey/ })).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByRole('button', { name: /Lewis Boden/ })).getAttribute('aria-pressed')).toBe('true')

    confirmSpy.mockRestore()
  })

  it("shows a call-up candidate's team badge in the Other players section even when a team is chosen", () => {
    setup()
    fireEvent.change(screen.getByLabelText(/team/i), { target: { value: 't-prem' } })
    const lewisButton = screen.getByRole('button', { name: /Lewis Boden/ })
    expect(lewisButton.textContent).toContain('Blue')
  })
})
