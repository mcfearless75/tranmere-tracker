import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChangePinForm } from '@/components/account/ChangePinForm'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const updateUser = jest.fn().mockResolvedValue({ error: null })
const getUser = jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })
const eq = jest.fn().mockResolvedValue({ error: null })
const update = jest.fn(() => ({ eq }))
const from = jest.fn(() => ({ update }))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { updateUser: (...args: unknown[]) => updateUser(...args), getUser: () => getUser() },
    from: (...args: unknown[]) => from(...args),
  }),
}))

beforeEach(() => jest.clearAllMocks())

function fillPins(pin: string, confirm: string) {
  fireEvent.change(screen.getByPlaceholderText('New PIN'), { target: { value: pin } })
  fireEvent.change(screen.getByPlaceholderText('Confirm PIN'), { target: { value: confirm } })
}

describe('ChangePinForm', () => {
  it('rejects a PIN shorter than 5 digits', () => {
    render(<ChangePinForm />)
    fillPins('1234', '1234')
    expect(screen.getByRole('button', { name: /save my new pin/i })).toBeDisabled()
  })

  it('rejects mismatched PINs', async () => {
    render(<ChangePinForm />)
    fillPins('123456', '654321')
    fireEvent.click(screen.getByRole('button', { name: /save my new pin/i }))
    expect(await screen.findByText(/don't match/i)).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rejects the shared default PIN', async () => {
    render(<ChangePinForm />)
    fillPins('000000', '000000')
    fireEvent.click(screen.getByRole('button', { name: /save my new pin/i }))
    expect(await screen.findByText(/other than the shared default/i)).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('updates the auth password and clears must_change_pin on success', async () => {
    jest.useFakeTimers({ advanceTimers: true })
    const onDone = jest.fn()
    render(<ChangePinForm onDone={onDone} />)
    fillPins('194756', '194756')
    fireEvent.click(screen.getByRole('button', { name: /save my new pin/i }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: '194756' }))
    await waitFor(() => expect(from).toHaveBeenCalledWith('users'))
    expect(update).toHaveBeenCalledWith({ must_change_pin: false })
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
    expect(await screen.findByText(/pin updated/i)).toBeInTheDocument()
    expect(refreshMock).toHaveBeenCalledTimes(1)

    // onDone is deliberately delayed so the confirmation is seen first —
    // see ChangePinPromptCard.test.tsx for the visible-then-vanishes case.
    expect(onDone).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1800)
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    jest.useRealTimers()
  })

  it('surfaces an auth error and does not touch the profile row', async () => {
    updateUser.mockResolvedValueOnce({ error: { message: 'Password too weak' } })
    render(<ChangePinForm />)
    fillPins('194756', '194756')
    fireEvent.click(screen.getByRole('button', { name: /save my new pin/i }))

    expect(await screen.findByText('Password too weak')).toBeInTheDocument()
    expect(from).not.toHaveBeenCalled()
  })
})
