import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

const signInWithOAuth = jest.fn().mockResolvedValue({ error: null })
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args) },
  }),
}))

beforeEach(() => jest.clearAllMocks())

describe('GoogleSignInButton', () => {
  it('renders a Google sign-in button', () => {
    render(<GoogleSignInButton />)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('starts the Google OAuth flow with a callback redirect carrying next', async () => {
    render(<GoogleSignInButton next="/dashboard" />)
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1))
    const arg = signInWithOAuth.mock.calls[0][0] as {
      provider: string
      options: { redirectTo: string }
    }
    expect(arg.provider).toBe('google')
    expect(arg.options.redirectTo).toContain('/auth/callback')
    expect(arg.options.redirectTo).toContain('next=%2Fdashboard')
  })

  it('surfaces an error if the OAuth start fails', async () => {
    signInWithOAuth.mockResolvedValueOnce({ error: { message: 'boom' } })
    render(<GoogleSignInButton />)
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    expect(await screen.findByText(/could not start google sign-in/i)).toBeInTheDocument()
  })
})
