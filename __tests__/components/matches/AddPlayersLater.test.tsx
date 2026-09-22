import { render, screen } from '@testing-library/react'
import { AddPlayersLater } from '@/app/(admin)/admin/match-events/[id]/AddPlayersLater'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

const fetchMock = jest.fn((..._args: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
;(global as any).fetch = fetchMock

const PREM = { id: 't-prem', name: 'Prem' }
const BLUE = { id: 't-blue', name: 'Blue' }

const AVAILABLE = [
  { id: 'p1', name: 'Alfie Casey', team_id: 't-blue', teams: BLUE },
  { id: 'p2', name: 'Lewis Boden', team_id: 't-prem', teams: PREM },
  { id: 'p3', name: 'Khalid Eletu', team_id: null, teams: null },
  { id: 'p4', name: 'Troy Lockyer', team_id: 't-prem', teams: PREM },
]

function renderPicker(matchTeamId: string | null) {
  render(
    <AddPlayersLater matchId="m1" opponent="Everton Academy" matchTeamId={matchTeamId} available={AVAILABLE} />
  )
}

describe('AddPlayersLater — team ordering and badges', () => {
  it('sorts players on the match\'s own team before everyone else', () => {
    renderPicker('t-prem')
    const names = screen.getAllByRole('button', { name: /Casey|Boden|Eletu|Lockyer/ }).map(b => b.textContent)
    // Prem players (Lewis Boden, Troy Lockyer) must both precede the two
    // non-Prem players (Alfie Casey on Blue, Khalid Eletu on no team).
    const bodenIdx = names.findIndex(n => n?.includes('Lewis Boden'))
    const lockyerIdx = names.findIndex(n => n?.includes('Troy Lockyer'))
    const caseyIdx = names.findIndex(n => n?.includes('Alfie Casey'))
    const eletuIdx = names.findIndex(n => n?.includes('Khalid Eletu'))
    expect(bodenIdx).toBeLessThan(caseyIdx)
    expect(bodenIdx).toBeLessThan(eletuIdx)
    expect(lockyerIdx).toBeLessThan(caseyIdx)
    expect(lockyerIdx).toBeLessThan(eletuIdx)
  })

  it('does not reorder anything when the match has no team', () => {
    renderPicker(null)
    const names = screen.getAllByRole('button', { name: /Casey|Boden|Eletu|Lockyer/ }).map(b => b.textContent)
    const order = ['Alfie Casey', 'Lewis Boden', 'Khalid Eletu', 'Troy Lockyer']
    order.forEach((n, i) => expect(names[i]).toContain(n))
  })

  it('renders a team badge for a player who has a team', () => {
    renderPicker('t-prem')
    const bodenButton = screen.getByRole('button', { name: /Lewis Boden/ })
    expect(bodenButton.textContent).toContain('Prem')
  })

  it('renders no team badge for a player with no team', () => {
    renderPicker('t-prem')
    const eletuButton = screen.getByRole('button', { name: /Khalid Eletu/ })
    expect(eletuButton.textContent).toBe('Khalid Eletu')
  })

  it('does not pre-tick anybody', () => {
    renderPicker('t-prem')
    // This screen adds one missing player, not build a squad — nothing
    // should be pre-selected, so the "Invite" button starts disabled.
    expect(screen.getByRole('button', { name: /Invite/ })).toBeDisabled()
  })
})
