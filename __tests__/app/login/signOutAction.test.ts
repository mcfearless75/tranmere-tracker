/**
 * @jest-environment node
 */
const signOutMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { signOut: (...args: unknown[]) => signOutMock(...args) } }),
}))

// redirect() throws internally in real Next.js — mirrored here so a caller
// that doesn't reach it (a bug this exact test guards against) is
// distinguishable from one that does.
const redirectMock = jest.fn(() => { throw new Error('NEXT_REDIRECT') })
jest.mock('next/navigation', () => ({ redirect: (...args: unknown[]) => redirectMock(...args) }))

import { signOut } from '@/app/(auth)/login/actions'

describe('signOut', () => {
  beforeEach(() => {
    signOutMock.mockReset()
    redirectMock.mockClear()
  })

  it('redirects to /login after a successful sign-out', async () => {
    signOutMock.mockResolvedValue({ error: null })
    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT')
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' })
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  // Confirmed live 2026-09-10: a student tapped "sign out" and nothing
  // visible happened, even after a full app refresh (ruling out a stale
  // bundle). No error reached the client at all — consistent with
  // auth.signOut() throwing (e.g. an already-invalidated refresh token from
  // the same forced-logout churn fixed elsewhere tonight) before ever
  // reaching redirect(), with the rejected Server Action silently swallowed
  // client-side. Whatever the failure, tapping "sign out" must always land
  // the user on /login — a session that's already broken is, from the
  // user's perspective, nothing to distinguish from a successful sign-out.
  it('still redirects to /login even if auth.signOut() throws', async () => {
    signOutMock.mockRejectedValue(new Error('Refresh Token Not Found'))
    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })
})
