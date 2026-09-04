// Turns a Supabase sign-in failure into something a student at a numpad can
// act on. The forms used to collapse every failure into "Incorrect PIN", which
// is actively harmful when the real cause is the per-IP rate limit: a whole
// class behind one school router hits 429, every student assumes they typed
// the wrong PIN, retries, and keeps the bucket empty.

export type SignInErrorLike = {
  status?: number
  code?: string
  name?: string
  message?: string
}

export type SignInErrorInfo = {
  message: string
  /** True when the credentials may well be right — keep the typed PIN so they can just retry. */
  retryable: boolean
}

const RATE_LIMITED = 'Too many sign-in attempts from this network right now. Wait a minute, then tap Sign In again — your PIN is still entered.'
const OFFLINE = "Can't reach the server. Check your connection and tap Sign In again."
const UNAVAILABLE = 'Sign-in is temporarily unavailable. Wait a moment and tap Sign In again.'

export function describeSignInError(err: SignInErrorLike, wrongCredentials: string): SignInErrorInfo {
  if (err.status === 429 || err.code === 'over_request_rate_limit') {
    return { message: RATE_LIMITED, retryable: true }
  }
  // auth-js wraps fetch failures (no network, DNS, CORS) in AuthRetryableFetchError
  // with no HTTP status; a plain TypeError from fetch has no status either.
  if (err.name === 'AuthRetryableFetchError' || err.status === undefined || err.status === 0) {
    return { message: OFFLINE, retryable: true }
  }
  if (err.status >= 500) {
    return { message: UNAVAILABLE, retryable: true }
  }
  return { message: wrongCredentials, retryable: false }
}
