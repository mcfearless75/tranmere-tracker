import { isAllowedEmailDomain, ALLOWED_EMAIL_DOMAINS } from '@/lib/config/auth'

describe('isAllowedEmailDomain', () => {
  it('accepts the student Workspace domain', () => {
    expect(isAllowedEmailDomain('jo.bloggs@tranmere.academy')).toBe(true)
  })

  it('accepts the staff domain', () => {
    expect(isAllowedEmailDomain('coach@tranmererovers.co.uk')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isAllowedEmailDomain('Jo@Tranmere.Academy')).toBe(true)
  })

  it('rejects a non-academy domain', () => {
    expect(isAllowedEmailDomain('someone@gmail.com')).toBe(false)
  })

  it('rejects null, undefined and empty', () => {
    expect(isAllowedEmailDomain(null)).toBe(false)
    expect(isAllowedEmailDomain(undefined)).toBe(false)
    expect(isAllowedEmailDomain('')).toBe(false)
  })

  it('rejects a malformed address with no domain', () => {
    expect(isAllowedEmailDomain('not-an-email')).toBe(false)
  })

  it('has at least one configured domain', () => {
    expect(ALLOWED_EMAIL_DOMAINS.length).toBeGreaterThan(0)
  })
})
