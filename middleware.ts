import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  copyCookies,
  isAuthRetryable,
  safeNextPath,
  unauthenticatedAction,
} from '@/lib/middleware/authGate'

const PUBLIC_PATHS = ['/login', '/signup', '/setup', '/api/setup', '/admin-login', '/staff-login', '/trials', '/api/recruitment/apply', '/privacy', '/welcome']
// Crash telemetry from error boundaries. A crash can happen before login (or
// after a session has just died), and answering it with a 307 to /login
// meant those reports never reached Vercel's logs at all.
const NO_SESSION_PATHS = ['/api/client-error']
// Public paths that signed-in users may still visit (no bounce to their dashboard).
const OPEN_TO_ALL = ['/admin-login', '/staff-login', '/trials', '/api/recruitment/apply', '/privacy', '/welcome']
const STUDENT_PREFIXES = ['/dashboard', '/coursework', '/nutrition', '/training', '/matches', '/profile', '/gps', '/attendance', '/timetable']
const PARENT_PREFIXES = ['/parent']
// Server-to-server endpoints: Vercel crons, push fan-out, LTI. Each authenticates
// itself (CRON_SECRET bearer / shared secret / LTI OIDC) and fails closed when the
// secret is absent. Gating them on a browser session would leave the callers
// silently dead, so they bypass the session check entirely.
const SERVER_TO_SERVER_PREFIXES = ['/api/cron/', '/api/push/send', '/api/lti/']

// Role cache: signed httpOnly cookie so repeat navigations skip the REST lookup.
// Short TTL keeps role changes near-live; the cookie is bound to the user id,
// so a different (or absent) session can never reuse a stale role.
const ROLE_COOKIE = 'tt-role'
const ROLE_TTL_SECONDS = 300 // 5 minutes

async function signRolePayload(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function readCachedRole(
  request: NextRequest,
  userId: string,
  secret: string,
): Promise<string | null> {
  const raw = request.cookies.get(ROLE_COOKIE)?.value
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 4) return null
  const [uid, role, expiry, sig] = parts
  if (uid !== userId) return null
  const expiresAt = Number.parseInt(expiry, 10)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null
  const expected = await signRolePayload(`${uid}.${role}.${expiry}`, secret)
  if (sig !== expected) return null
  return role
}

async function attachRoleCookie(
  response: NextResponse,
  userId: string,
  role: string,
  secret: string,
): Promise<NextResponse> {
  const expiresAt = Date.now() + ROLE_TTL_SECONDS * 1000
  const payload = `${userId}.${role}.${expiresAt}`
  const sig = await signRolePayload(payload, secret)
  response.cookies.set(ROLE_COOKIE, `${payload}.${sig}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ROLE_TTL_SECONDS,
  })
  return response
}

async function getUserRole(
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=role`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: 'no-store',
      },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as { role: string }[]
    return rows[0]?.role ?? null
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (SERVER_TO_SERVER_PREFIXES.some(p => path.startsWith(p)) || NO_SESSION_PATHS.includes(path)) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p))

  // Any response we hand back must carry the auth cookies Supabase rotated
  // (or deleted) while handling THIS request. A bare NextResponse.redirect()
  // dropped them — the browser kept a refresh token GoTrue had just revoked,
  // and the very next request died with "Invalid Refresh Token: Already Used"
  // (56 forced logouts in the week to 2026-09-10). See lib/middleware/authGate.ts.
  const withSessionCookies = (response: NextResponse): NextResponse => {
    copyCookies(supabaseResponse.cookies, response.cookies)
    return response
  }

  // GoTrue unreachable (network blip / 5xx) is not "logged out". Pass the
  // request through untouched — the page's own server-side auth check will
  // decide — instead of bouncing a live session to /login and wiping cookies.
  if (!user && isAuthRetryable(authError) && !isPublic) {
    return supabaseResponse
  }

  // Unauthenticated on a protected resource → /login (preserve destination),
  // or a JSON 401 for /api/* so `res.json()` on the client gets a clean
  // "Unauthorised" instead of throwing on the login page's HTML.
  if (!user && !isPublic) {
    const action = unauthenticatedAction(request.nextUrl.pathname, request.nextUrl.search)
    if (action.kind === 'json401') {
      const res = NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 })
      res.cookies.delete(ROLE_COOKIE)
      return withSessionCookies(res)
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', action.next)
    const redirect = withSessionCookies(NextResponse.redirect(loginUrl))
    redirect.cookies.delete(ROLE_COOKIE) // logged out — drop any cached role
    return redirect
  }

  if (!user) {
    supabaseResponse.cookies.delete(ROLE_COOKIE) // logged out — drop any cached role
    return supabaseResponse
  }

  // Decide if we need role-based routing for this path
  const needsRoleCheck =
    path.startsWith('/admin') ||
    STUDENT_PREFIXES.some(p => path === p || path.startsWith(p + '/')) ||
    PARENT_PREFIXES.some(p => path === p || path.startsWith(p + '/')) ||
    (isPublic && !OPEN_TO_ALL.some(p => path.startsWith(p)))

  if (!needsRoleCheck) return supabaseResponse

  const cacheSecret = process.env.SUPABASE_SERVICE_ROLE_KEY!
  let role = await readCachedRole(request, user.id, cacheSecret)
  const isCacheHit = role !== null

  if (!role) {
    role = await getUserRole(
      user.id,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      cacheSecret,
    )
  }

  // If role lookup fails, allow through — layouts will do their own checks
  if (!role) return supabaseResponse

  // On a fresh lookup, cache the role on whichever response we return.
  const finalise = (response: NextResponse): Promise<NextResponse> | NextResponse =>
    isCacheHit ? response : attachRoleCookie(response, user.id, role as string, cacheSecret)
  // Role-based redirects are fresh responses too — they must carry the
  // rotated session cookies for the same reason as the /login redirect above.
  const redirectTo = (target: string) =>
    finalise(withSessionCookies(NextResponse.redirect(new URL(target, request.url))))

  const isStaff = role === 'admin' || role === 'coach' || role === 'teacher'
  const isParent = role === 'parent'

  // Authenticated user on auth page → role-appropriate home. If they arrived
  // with a safe `next` (e.g. a second NFC/QR tap while already signed in:
  // /login?next=/attendance?tag=…) honour it — previously this bounced them
  // to their home and the check-in silently never happened.
  if (isPublic && !OPEN_TO_ALL.some(p => path.startsWith(p))) {
    const next = safeNextPath(request.nextUrl.searchParams.get('next'))
    const home = isStaff ? '/admin/gps-dashboard' : isParent ? '/parent/dashboard' : '/dashboard'
    return redirectTo(next ?? home)
  }

  // Staff hitting student pages → admin area
  if (isStaff && STUDENT_PREFIXES.some(p => path === p || path.startsWith(p + '/'))) {
    return redirectTo('/admin/gps-dashboard')
  }

  // Students hitting admin pages → dashboard
  if (!isStaff && path.startsWith('/admin')) {
    return redirectTo('/dashboard')
  }

  // Parents hitting student or admin pages → parent portal
  if (isParent && (STUDENT_PREFIXES.some(p => path === p || path.startsWith(p + '/')) || path.startsWith('/admin'))) {
    return redirectTo('/parent/dashboard')
  }

  // Non-parents hitting parent pages → appropriate home
  if (!isParent && PARENT_PREFIXES.some(p => path === p || path.startsWith(p + '/'))) {
    return redirectTo(isStaff ? '/admin/gps-dashboard' : '/dashboard')
  }

  return finalise(supabaseResponse)
}

export const config = {
  // Excluded on top of the Next internals: the service-worker scripts
  // (sw.js, workbox-*.js, push-worker.js) and static assets under /fonts.
  // Each used to trigger a full GoTrue session refresh per fetch, and a
  // logged-out browser's service-worker install was answered with a 307 to
  // /login — an HTML body where a script was expected.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|.well-known|sw.js|workbox-|push-worker.js|fonts/).*)',
  ],
}
