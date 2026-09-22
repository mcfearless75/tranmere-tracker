/**
 * The four student log forms all shared one shape: insert, clear the form,
 * refresh — with the insert error never read. A cleared form is the only
 * confirmation these give, so a failed write read as a successful save.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TrainingLogForm } from '@/components/training/TrainingLogForm'
import { MatchLogForm } from '@/components/matches/MatchLogForm'
import { UkFoodSearch } from '@/components/nutrition/UkFoodSearch'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const insertMock = jest.fn()
const fromMock = jest.fn(() => ({ insert: (...args: unknown[]) => insertMock(...args) }))
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: (...args: unknown[]) => fromMock(...(args as [])) }),
}))

beforeEach(() => jest.clearAllMocks())

describe('TrainingLogForm', () => {
  function fillDuration(value: string) {
    fireEvent.change(screen.getByPlaceholderText('Duration (mins)'), { target: { value } })
  }

  it('clears the form and refreshes once the session is actually saved', async () => {
    insertMock.mockResolvedValueOnce({ error: null })
    render(<TrainingLogForm studentId="s1" />)
    fillDuration('45')

    fireEvent.click(screen.getByRole('button', { name: 'Log Session' }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
    expect(screen.getByPlaceholderText('Duration (mins)')).toHaveValue(null)
  })

  it('keeps the entry and shows the reason when the insert fails', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'duration_mins out of range' } })
    render(<TrainingLogForm studentId="s1" />)
    fillDuration('45')

    fireEvent.click(screen.getByRole('button', { name: 'Log Session' }))

    await waitFor(() => expect(screen.getByText('duration_mins out of range')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Duration (mins)')).toHaveValue(45)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('recovers the button when the request never reaches the server', async () => {
    insertMock.mockRejectedValueOnce(new Error('Failed to fetch'))
    render(<TrainingLogForm studentId="s1" />)
    fillDuration('45')

    fireEvent.click(screen.getByRole('button', { name: 'Log Session' }))

    await waitFor(() =>
      expect(screen.getByText(/Could not save that session — you may be offline/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Log Session' })).not.toBeDisabled()
  })
})

describe('MatchLogForm', () => {
  it('keeps the opponent and shows the reason when the insert fails', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'self_rating must be 1-10' } })
    render(<MatchLogForm studentId="s1" />)
    fireEvent.change(screen.getByPlaceholderText('Opponent'), { target: { value: 'Wigan' } })

    fireEvent.click(screen.getByRole('button', { name: 'Log Match' }))

    await waitFor(() => expect(screen.getByText('self_rating must be 1-10')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Opponent')).toHaveValue('Wigan')
    expect(refreshMock).not.toHaveBeenCalled()
  })
})

describe('UkFoodSearch', () => {
  function firstQuickPick() {
    return screen.getAllByRole('button', { name: /\+ Log$/ })[0]
  }

  it('shows the added tick once the food is actually logged', async () => {
    insertMock.mockResolvedValueOnce({ error: null })
    render(<UkFoodSearch studentId="s1" />)

    fireEvent.click(firstQuickPick())

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('does not show the added tick when the insert fails', async () => {
    // The green tick is this component's only confirmation, so it must not
    // fire on a failed write.
    insertMock.mockResolvedValueOnce({ error: { message: 'nutrition_logs denied' } })
    render(<UkFoodSearch studentId="s1" />)
    const button = firstQuickPick()

    fireEvent.click(button)

    await waitFor(() => expect(screen.getByText(/nutrition_logs denied/)).toBeInTheDocument())
    expect(refreshMock).not.toHaveBeenCalled()
    expect(button).not.toBeDisabled()
  })
})
