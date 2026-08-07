import { safeEqual, verifyCronSecret } from '@/lib/security'

function fakeRequest(headers: Record<string, string>) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return { headers: { get: (name: string) => lower[name.toLowerCase()] ?? null } }
}

describe('safeEqual', () => {
  it('returns true for identical strings', () => {
    expect(safeEqual('secret-123', 'secret-123')).toBe(true)
  })

  it('returns false for different strings of the same length', () => {
    expect(safeEqual('secret-123', 'secret-124')).toBe(false)
  })

  it('returns false for strings of different lengths (no throw)', () => {
    expect(safeEqual('short', 'much-longer-value')).toBe(false)
  })

  it('fails closed on empty strings', () => {
    expect(safeEqual('', '')).toBe(false)
    expect(safeEqual('value', '')).toBe(false)
    expect(safeEqual('', 'value')).toBe(false)
  })

  it('fails closed on null/undefined (unset env secret can never match)', () => {
    expect(safeEqual(null, 'value')).toBe(false)
    expect(safeEqual('value', undefined)).toBe(false)
    expect(safeEqual(undefined, undefined)).toBe(false)
    expect(safeEqual(null, null)).toBe(false)
    // The classic fail-open bug: header "undefined" vs unset env
    expect(safeEqual('undefined', undefined)).toBe(false)
  })

  it('handles multi-byte characters without throwing', () => {
    expect(safeEqual('pìn-å', 'pìn-å')).toBe(true)
    expect(safeEqual('pìn-å', 'pin-a')).toBe(false)
  })
})

describe('verifyCronSecret', () => {
  const ORIGINAL = process.env.CRON_SECRET

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL
  })

  it('accepts the correct Bearer secret', () => {
    process.env.CRON_SECRET = 'top-secret'
    expect(verifyCronSecret(fakeRequest({ authorization: 'Bearer top-secret' }))).toBe(true)
  })

  it('rejects a wrong secret', () => {
    process.env.CRON_SECRET = 'top-secret'
    expect(verifyCronSecret(fakeRequest({ authorization: 'Bearer wrong' }))).toBe(false)
  })

  it('rejects a missing Authorization header', () => {
    process.env.CRON_SECRET = 'top-secret'
    expect(verifyCronSecret(fakeRequest({}))).toBe(false)
  })

  it('fails closed when CRON_SECRET is unset — even against "Bearer undefined"', () => {
    delete process.env.CRON_SECRET
    expect(verifyCronSecret(fakeRequest({ authorization: 'Bearer undefined' }))).toBe(false)
    expect(verifyCronSecret(fakeRequest({}))).toBe(false)
  })

  it('fails closed when CRON_SECRET is an empty string', () => {
    process.env.CRON_SECRET = ''
    expect(verifyCronSecret(fakeRequest({ authorization: 'Bearer ' }))).toBe(false)
  })
})
