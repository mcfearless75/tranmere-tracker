import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MatchInvitations } from '@/app/(student)/matches/MatchInvitations'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const eqMock = jest.fn()
const updateMock = jest.fn(() => ({ eq: eqMock }))
const fromMock = jest.fn(() => ({ update: updateMock }))
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: (...args: unknown[]) => fromMock(...(args as [])) }),
}))

beforeEach(() => jest.clearAllMocks())

const invitation = {
  id: 'squad-1',
  status: 'invited',
  coach_rating: null,
  position: null,
  match_events: {
    id: 'match-1',
    match_date: '2026-10-04',
    kick_off_time: null,
    opponent: 'Wigan',
    location: 'Prenton Park',
    status: 'scheduled',
  },
}

describe('MatchInvitations', () => {
  it('keeps the optimistic status when the write succeeds', async () => {
    eqMock.mockResolvedValueOnce({ error: null })
    render(<MatchInvitations invitations={[invitation]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
    expect(updateMock).toHaveBeenCalledWith({ status: 'accepted' })
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
    expect(screen.getByText('accepted')).toBeInTheDocument()
  })

  it('rolls the optimistic status back and explains itself when the write fails', async () => {
    // `invitations` is useState(props) and router.refresh() does not re-seed
    // it, so without the rollback the student would see "accepted" forever
    // while the DB still said "invited".
    eqMock.mockResolvedValueOnce({ error: { message: 'row-level security' } })
    render(<MatchInvitations invitations={[invitation]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

    await waitFor(() => expect(screen.getByText('row-level security')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    expect(screen.queryByText('accepted')).not.toBeInTheDocument()
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('rolls back and stays usable when the request never reaches the server', async () => {
    eqMock.mockRejectedValueOnce(new Error('Failed to fetch'))
    render(<MatchInvitations invitations={[invitation]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))

    await waitFor(() => expect(screen.getByText('Failed to fetch')).toBeInTheDocument())
    const accept = screen.getByRole('button', { name: 'Accept' })
    expect(accept).toBeInTheDocument()
    // The busy flag clears in `finally`, so the buttons are not left dead.
    expect(accept).not.toBeDisabled()
  })
})
