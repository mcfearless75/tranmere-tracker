import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { PhaseDayCard } from '@/components/attendance/PhaseDayCard'
import type { PhaseWindows } from '@/lib/attendance/phase'

jest.mock('@/app/(student)/attendance/InAppCheckIn', () => ({
  InAppCheckIn: ({ phase }: { phase: string }) => <button>Check in — {phase}</button>,
}))

const WINDOWS: PhaseWindows = {
  am: { start: '07:30', end: '10:30' },
  lunch: { start: '11:00', end: '14:30' },
  pm: { start: '14:30', end: '17:30' },
}

// Wednesday, during the lunch window (13:00 London / 12:00 UTC in BST).
const DURING_LUNCH = new Date('2026-09-16T12:00:00Z')
const SATURDAY = new Date('2026-09-19T12:00:00Z')

function queryPermission(state: 'granted' | 'denied' | 'prompt') {
  return jest.fn(() => Promise.resolve({ state } as PermissionStatus))
}

function setPermissions(query: typeof navigator.permissions.query | undefined) {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: query ? { query } : undefined,
  })
}

afterEach(() => {
  setPermissions(undefined)
  try { sessionStorage.clear() } catch { /* noop */ }
  try { localStorage.clear() } catch { /* noop */ }
})

describe('PhaseDayCard', () => {
  it('shows the CTA copy only for the open, missing phase', async () => {
    setPermissions(queryPermission('granted'))
    render(<PhaseDayCard windows={WINDOWS} daily={null} excusal={null} now={DURING_LUNCH} />)
    expect(await screen.findByText('Lunch check-in still needed')).toBeInTheDocument()
    expect(screen.queryByText(/Morning check-in still needed/)).not.toBeInTheDocument()
    expect(screen.queryByText(/End of day check-out still needed/)).not.toBeInTheDocument()
  })

  it('shows "Done for today" once every phase is checked or excused', () => {
    render(
      <PhaseDayCard
        windows={WINDOWS}
        daily={{ am_checked_at: '2026-09-16T08:00:00Z', lunch_checked_at: '2026-09-16T12:00:00Z', pm_checked_at: null }}
        excusal={{ phases: ['pm'] }}
        now={DURING_LUNCH}
      />
    )
    expect(screen.getByText('Done for today')).toBeInTheDocument()
  })

  it('shows "No check-in today" on a weekend', () => {
    render(<PhaseDayCard windows={WINDOWS} daily={null} excusal={null} now={SATURDAY} />)
    expect(screen.getByText('No check-in today.')).toBeInTheDocument()
  })

  it('shows the next window when nothing is open yet', () => {
    const beforeAm = new Date('2026-09-16T05:00:00Z') // 06:00 London
    render(<PhaseDayCard windows={WINDOWS} daily={null} excusal={null} now={beforeAm} />)
    expect(screen.getByText('Morning check-in opens at 07:30')).toBeInTheDocument()
  })

  it('shows the geo explainer before the check-in button when permission is still "prompt"', async () => {
    setPermissions(queryPermission('prompt'))
    render(<PhaseDayCard windows={WINDOWS} daily={null} excusal={null} now={DURING_LUNCH} />)
    expect(await screen.findByText("We'll ask for your location")).toBeInTheDocument()
    expect(screen.queryByText('Check in — lunch')).not.toBeInTheDocument()
  })

  it('skips the explainer and shows the check-in button once permission is already granted', async () => {
    setPermissions(queryPermission('granted'))
    render(<PhaseDayCard windows={WINDOWS} daily={null} excusal={null} now={DURING_LUNCH} />)
    expect(await screen.findByText('Check in — lunch')).toBeInTheDocument()
    expect(screen.queryByText("We'll ask for your location")).not.toBeInTheDocument()
  })

  it('skips the explainer a second time in the same session, after it was already dismissed', async () => {
    setPermissions(queryPermission('prompt'))
    const { unmount } = render(<PhaseDayCard windows={WINDOWS} daily={null} excusal={null} now={DURING_LUNCH} />)
    const continueButton = await screen.findByText('Continue')
    fireEvent.click(continueButton)
    expect(await screen.findByText('Check in — lunch')).toBeInTheDocument()
    unmount()

    // Re-mount (simulates navigating back to this card later the same session).
    render(<PhaseDayCard windows={WINDOWS} daily={null} excusal={null} now={DURING_LUNCH} />)
    await waitFor(() => expect(screen.getByText('Check in — lunch')).toBeInTheDocument())
    expect(screen.queryByText("We'll ask for your location")).not.toBeInTheDocument()
  })

  it('shows Settings steps, but still offers the check-in button, when permission is already denied', async () => {
    setPermissions(queryPermission('denied'))
    render(<PhaseDayCard windows={WINDOWS} daily={null} excusal={null} now={DURING_LUNCH} />)
    expect(await screen.findByText('Location is off for this site')).toBeInTheDocument()
    expect(screen.getByText('Check in — lunch')).toBeInTheDocument()
    // The explainer would be pointless once we already know it's denied.
    expect(screen.queryByText("We'll ask for your location")).not.toBeInTheDocument()
  })

  it('treats an unsupported Permissions API (e.g. iOS Safari) the same as "prompt" — shows the explainer first', async () => {
    setPermissions(undefined)
    render(<PhaseDayCard windows={WINDOWS} daily={null} excusal={null} now={DURING_LUNCH} />)
    expect(await screen.findByText("We'll ask for your location")).toBeInTheDocument()
  })

  it('shows a pending (amber) segment dot for a phase with a check-in queued offline but not yet server-confirmed', async () => {
    // The queue module keys "today" off the REAL device clock (it's about
    // when the app is actually opened, not the test's simulated `now` used
    // for window-open decisions) — seed with the real current London date.
    const todayLondon = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
    localStorage.setItem(
      'checkin_queue_v1',
      JSON.stringify([
        { phase: 'am', lat: 1, lng: 2, accuracy: 10, recordedAt: '2026-09-16T08:00:00Z', londonDate: todayLondon },
      ]),
    )
    setPermissions(queryPermission('granted'))
    render(<PhaseDayCard windows={WINDOWS} daily={null} excusal={null} now={DURING_LUNCH} />)
    expect(await screen.findByLabelText('AM pending')).toBeInTheDocument()
    // Still missing/not-yet-confirmed server-side, so the lunch CTA (the
    // real open phase) is unaffected by AM's queued state.
    expect(screen.getByText('Lunch check-in still needed')).toBeInTheDocument()
  })

  it('does not show a pending dot once the phase is actually checked (a real tap wins over a stale queue entry)', () => {
    const todayLondon = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
    localStorage.setItem(
      'checkin_queue_v1',
      JSON.stringify([
        { phase: 'am', lat: 1, lng: 2, accuracy: 10, recordedAt: '2026-09-16T08:00:00Z', londonDate: todayLondon },
      ]),
    )
    render(
      <PhaseDayCard
        windows={WINDOWS}
        daily={{ am_checked_at: '2026-09-16T08:00:00Z', lunch_checked_at: null, pm_checked_at: null }}
        excusal={null}
        now={DURING_LUNCH}
      />,
    )
    expect(screen.getByLabelText('AM done')).toBeInTheDocument()
    expect(screen.queryByLabelText('AM pending')).not.toBeInTheDocument()
  })
})
