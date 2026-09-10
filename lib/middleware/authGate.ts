/**
 * Pure decision helpers for middleware.ts. Kept free of any `next/server`
 * import so they can be unit-tested in jsdom without an Edge runtime.
 *
 * Background (production evidence, 2026-09-10): Vercel logged 88 ×
 * "Invalid Refresh Token: Refresh Token Not Found" and 56 × "Invalid Refresh
 * Token: Already Used" from /middleware in a week, plus students hitting
 * "Something went wrong" / "Check-in failed" straight after a login.
 * Three middleware behaviours contributed:
 *
 *  1. Every redirect was a brand-new NextResponse, so any auth cookies the
 *     Supabase client had just rotated (or deleted) on that request were
 *     silently dropped — the browser kept the revoked refresh token and the
 *     next request failed with "Already Used" → forced logout.
 *  2. Unauthenticated `fetch('/api/...')` calls were answered with a 307 to
 *     the login HTML page; the client then tried `res.json()` on HTML and
 *     threw — surfaced to students as a generic crash instead of a clean
 *     "you're logged out".
 *  3. A transient GoTrue network error (`AuthRetryableFetchError`) was
 *     treated exactly like "logged out" and bounced a live session to /login.
 */

/** Minimal structural view of a cookie jar we can copy between responses. */
export interface CookieLike {
  name: string
  value: string
}
export interface CookieSource {
  getAll(): CookieLike[]
}
export interface CookieSink {
  set(cookie: CookieLike): unknown
}

/**
 * Copy every cookie (including deletions, which are cookies with an empty
 * value and maxAge 0) from one response onto another. Used so a redirect
 * response carries the Supabase session cookies the request just rotated.
 */
export function copyCookies<T extends CookieSink>(from: CookieSource, to: T): T {
  for (const cookie of from.getAll()) to.set(cookie)
  return to
}

/** `/api/*` callers expect JSON; never answer them with an HTML redirect. */
export function isApiRequest(path: string): boolean {
  return path === '/api' || path.startsWith('/api/')
}

/**
 * auth-js raises AuthRetryableFetchError when GoTrue itself could not be
 * reached (network blip, 5xx). That says nothing about the session being
 * invalid — treat it as "unknown", not "logged out".
 */
export function isAuthRetryable(error: { name?: string } | null | undefined): boolean {
  return error?.name === 'AuthRetryableFetchError'
}

/**
 * Validate a `next` destination we are willing to redirect to after login.
 * Must be a same-origin absolute path. Rejects protocol-relative (`//evil`),
 * absolute URLs, backslash tricks, and the auth pages themselves (which would
 * loop). Returns null when unsafe so callers fall back to the role home.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null
  // The WHATWG URL parser strips ASCII tab/newline BEFORE parsing, so
  // "/\t/evil.example" is really "//evil.example" — a protocol-relative URL.
  // String-sniffing the raw value is not enough; refuse any control
  // character outright, then let the parser decide what the value means.
  if (/[\u0000-\u001f\u007f]/.test(next)) return null
  if (!next.startsWith('/')) return null
  let parsed: URL
  try {
    parsed = new URL(next, 'http://next-check.invalid')
  } catch {
    return null
  }
  // Anything that resolved to a different origin was an absolute or
  // protocol-relative URL in disguise (backslashes included — the parser
  // treats "/\evil" as "//evil").
  if (parsed.origin !== 'http://next-check.invalid') return null
  const path = parsed.pathname + parsed.search
  if (/^\/(login|signup|admin-login|staff-login)(\/|\?|$)/.test(path)) return null
  return path
}

export type UnauthenticatedAction =
  | { kind: 'json401' }
  | { kind: 'redirect'; next: string }

/** What to do with an unauthenticated request for a protected resource. */
export function unauthenticatedAction(path: string, search: string): UnauthenticatedAction {
  if (isApiRequest(path)) return { kind: 'json401' }
  return { kind: 'redirect', next: path + search }
}
