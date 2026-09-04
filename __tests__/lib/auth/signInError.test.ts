import { describeSignInError } from '@/lib/auth/signInError'

const WRONG = 'Incorrect username or PIN'

describe('describeSignInError', () => {
  it('treats a 429 as a rate limit and keeps the PIN', () => {
    const info = describeSignInError({ status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' }, WRONG)
    expect(info.retryable).toBe(true)
    expect(info.message).toMatch(/too many sign-in attempts/i)
    expect(info.message).toMatch(/wait a minute/i)
  })

  it('recognises the rate-limit code even without a status', () => {
    expect(describeSignInError({ code: 'over_request_rate_limit' }, WRONG).retryable).toBe(true)
  })

  it('treats a fetch failure (no status) as offline, not wrong credentials', () => {
    const info = describeSignInError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }, WRONG)
    expect(info.retryable).toBe(true)
    expect(info.message).toMatch(/can't reach the server/i)
  })

  it('treats a 5xx as temporarily unavailable', () => {
    const info = describeSignInError({ status: 503, message: 'Service unavailable' }, WRONG)
    expect(info.retryable).toBe(true)
    expect(info.message).toMatch(/temporarily unavailable/i)
  })

  it('maps a 400 invalid_credentials to the wrong-credentials message and clears the PIN', () => {
    const info = describeSignInError({ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }, WRONG)
    expect(info).toEqual({ message: WRONG, retryable: false })
  })

  it('uses the caller-supplied wrong-credentials wording', () => {
    expect(describeSignInError({ status: 400 }, 'Incorrect PIN').message).toBe('Incorrect PIN')
  })
})
