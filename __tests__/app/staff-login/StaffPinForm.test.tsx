import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StaffPinForm } from '@/app/staff-login/StaffPinForm'

const pushMock = jest.fn()
const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock, refresh: refreshMock }) }))

const signInWithPassword = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithPassword: (...args: unknown[]) => signInWithPassword(...args) } }),
}))

beforeEach(() => jest.clearAllMocks())

function typeUsername(username: string) {
  fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: username } })
}

function tapPin(pin: string) {
  for (const d of pin) fireEvent.click(screen.getByRole('button', { name: d }))
}

function filledDots() {
  return document.querySelectorAll('.bg-tranmere-blue.rounded-full').length
}

describe('StaffPinForm', () => {
  it('signs in with the internal email and lands on the next target', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null })
    render(<StaffPinForm next="/attendance?tag=abc" />)
    typeUsername('AidanO')
    tapPin('000000')
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'aidano@tranmeretracker.internal',
      password: '000000',
    }))
    expect(pushMock).toHaveBeenCalledWith('/attendance?tag=abc')
    expect(refreshMock).toHaveBeenCalled()
  })

  it('shows the wrong-credentials message and clears the PIN on a 400', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' } })
    render(<StaffPinForm />)
    typeUsername('aidano')
    tapPin('123456')
    expect(filledDots()).toBe(6)
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('Incorrect username or PIN')).toBeInTheDocument()
    expect(filledDots()).toBe(0)
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('explains a 429 rate limit and keeps the PIN so they can retry', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' } })
    render(<StaffPinForm />)
    typeUsername('aidano')
    tapPin('000000')
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText(/too many sign-in attempts/i)).toBeInTheDocument()
    expect(screen.queryByText('Incorrect username or PIN')).not.toBeInTheDocument()
    expect(filledDots()).toBe(6)
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('explains a network failure rather than blaming the PIN', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } })
    render(<StaffPinForm />)
    typeUsername('aidano')
    tapPin('000000')
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText(/can't reach the server/i)).toBeInTheDocument()
    expect(filledDots()).toBe(6)
  })

  it('rejects an unsafe next target and falls back to /', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null })
    render(<StaffPinForm next="//evil.com" />)
    typeUsername('aidano')
    tapPin('000000')
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
  })
})
