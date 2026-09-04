import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChangePinPromptCard } from '@/components/account/ChangePinPromptCard'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const updateUser = jest.fn().mockResolvedValue({ error: null })
const getUser = jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })
const eq = jest.fn().mockResolvedValue({ error: null })
const from = jest.fn(() => ({ update: jest.fn(() => ({ eq })) }))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { updateUser: (...args: unknown[]) => updateUser(...args), getUser: () => getUser() },
    from: (...args: unknown[]) => from(...args),
  }),
}))

beforeEach(() => jest.clearAllMocks())

describe('ChangePinPromptCard', () => {
  it('shows the nudge collapsed by default, with the form hidden', () => {
    render(<ChangePinPromptCard />)
    expect(screen.getByText(/using the shared default pin/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('New PIN')).not.toBeInTheDocument()
  })

  it('expands into the change-PIN form on click', () => {
    render(<ChangePinPromptCard />)
    fireEvent.click(screen.getByRole('button', { name: /set my pin now/i }))
    expect(screen.getByPlaceholderText('New PIN')).toBeInTheDocument()
  })

  it('shows the confirmation, then disappears shortly after the PIN is changed', async () => {
    jest.useFakeTimers({ advanceTimers: true })
    render(<ChangePinPromptCard />)
    fireEvent.click(screen.getByRole('button', { name: /set my pin now/i }))

    fireEvent.change(screen.getByPlaceholderText('New PIN'), { target: { value: '194756' } })
    fireEvent.change(screen.getByPlaceholderText('Confirm PIN'), { target: { value: '194756' } })
    fireEvent.click(screen.getByRole('button', { name: /save my new pin/i }))

    // Confirmation is visible first — the card must not vanish before the
    // student actually sees it worked.
    expect(await screen.findByText(/pin updated/i)).toBeInTheDocument()

    jest.advanceTimersByTime(1800)
    await waitFor(() => expect(screen.queryByText(/pin updated/i)).not.toBeInTheDocument())
    jest.useRealTimers()
  })
})
