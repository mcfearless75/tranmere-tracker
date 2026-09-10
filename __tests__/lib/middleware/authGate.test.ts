import {
  copyCookies,
  isApiRequest,
  isAuthRetryable,
  safeNextPath,
  unauthenticatedAction,
} from '@/lib/middleware/authGate'

describe('copyCookies', () => {
  it('copies every cookie, including deletions, from one jar onto another', () => {
    const source = {
      getAll: () => [
        { name: 'sb-x-auth-token.0', value: 'new-rotated-token', maxAge: 34560000 },
        { name: 'sb-x-auth-token.1', value: '', maxAge: 0 },
      ],
    }
    const set = jest.fn()
    const target = { set }
    expect(copyCookies(source, target)).toBe(target)
    expect(set).toHaveBeenCalledTimes(2)
    expect(set).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'sb-x-auth-token.0', value: 'new-rotated-token' }))
    expect(set).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'sb-x-auth-token.1', value: '', maxAge: 0 }))
  })

  it('is a no-op for an empty jar', () => {
    const set = jest.fn()
    copyCookies({ getAll: () => [] }, { set })
    expect(set).not.toHaveBeenCalled()
  })
})

describe('isApiRequest', () => {
  it.each(['/api/attendance/check-in', '/api/push/subscribe', '/api'])('treats %s as an API request', p => {
    expect(isApiRequest(p)).toBe(true)
  })
  it.each(['/dashboard', '/apix', '/attendance?tag=abc', '/'])('treats %s as a page request', p => {
    expect(isApiRequest(p)).toBe(false)
  })
})

describe('isAuthRetryable', () => {
  it('recognises auth-js network failures', () => {
    expect(isAuthRetryable({ name: 'AuthRetryableFetchError' })).toBe(true)
  })
  it('does not treat a real auth rejection as retryable', () => {
    expect(isAuthRetryable({ name: 'AuthApiError' })).toBe(false)
    expect(isAuthRetryable(null)).toBe(false)
    expect(isAuthRetryable(undefined)).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('accepts a same-origin path with a query string (the NFC/QR tag link)', () => {
    expect(safeNextPath('/attendance?tag=9af4a580bbe347c5aacc551ba56e75c5&utm_source=x')).toBe(
      '/attendance?tag=9af4a580bbe347c5aacc551ba56e75c5&utm_source=x',
    )
  })

  it.each([
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
    ['absolute URL', 'https://evil.example/dashboard'],
    ['protocol-relative', '//evil.example/dashboard'],
    ['backslash trick', '/\\evil.example'],
    ['relative path', 'dashboard'],
    ['login page (would loop)', '/login'],
    ['login with query', '/login?next=/dashboard'],
    ['staff-login', '/staff-login'],
    ['admin-login sub path', '/admin-login/'],
  ])('rejects %s', (_label, value) => {
    expect(safeNextPath(value as string | null | undefined)).toBeNull()
  })

  it('does not reject a path that merely starts with the word login', () => {
    expect(safeNextPath('/login-help')).toBe('/login-help')
  })

  // The WHATWG URL parser strips ASCII tab and newline before parsing, so a
  // raw "/\t/evil.example" resolves to https://evil.example — an open
  // redirect if only the raw string is inspected. Found in review of 6c03409.
  it.each([
    ['tab-smuggled protocol-relative', '/\t/evil.example/x'],
    ['newline-smuggled protocol-relative', '/\n/evil.example'],
    ['carriage return', '/\r/evil.example'],
    ['NUL byte', '/attendance\u0000'],
    ['DEL', '/attendance\u007f'],
  ])('rejects %s', (_label, value) => {
    expect(safeNextPath(value)).toBeNull()
  })

  it('keeps a percent-encoded tab (harmless — it stays on this origin)', () => {
    expect(safeNextPath('/%09/x')).toBe('/%09/x')
  })

  it('returns the normalised path + query, never a fragment', () => {
    expect(safeNextPath('/attendance?tag=abc#frag')).toBe('/attendance?tag=abc')
  })
})

describe('unauthenticatedAction', () => {
  it('answers API calls with a JSON 401, never an HTML redirect', () => {
    expect(unauthenticatedAction('/api/attendance/check-in', '')).toEqual({ kind: 'json401' })
  })

  it('redirects page requests to login, preserving path and query', () => {
    expect(unauthenticatedAction('/attendance', '?tag=abc')).toEqual({
      kind: 'redirect',
      next: '/attendance?tag=abc',
    })
  })
})
