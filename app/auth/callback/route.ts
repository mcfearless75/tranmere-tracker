import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAllowedEmailDomain } from '@/lib/config/auth'

export const dynamic = 'force-dynamic'

function loginError(origin: string, message: string) {
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`)
}

/**
 * OAuth callback for Google sign-in. Exchanges the auth code for a session,
 * then enforces the academy email-domain allowlist (safeguarding): any account
 * outside the permitted Workspace domains is signed out and removed.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  // Reject '//evil.com' (protocol-relative) as well as absolute URLs.
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'

  if (!code) {
    return loginError(origin, 'Sign-in was cancelled or failed. Please try again.')
  }

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return loginError(origin, 'Could not complete Google sign-in. Please try again.')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!isAllowedEmailDomain(user?.email)) {
    // Not an academy account — sign out and remove the auto-created user
    // (the on_auth_user_created trigger inserts a default student row;
    // deleting the auth user cascades it away).
    await supabase.auth.signOut()
    if (user) {
      try {
        await createAdminClient().auth.admin.deleteUser(user.id)
      } catch {
        // best effort — the sign-out above already blocks access
      }
    }
    return loginError(origin, 'That Google account is not permitted. Please use your academy email.')
  }

  return NextResponse.redirect(`${origin}${next}`)
}
