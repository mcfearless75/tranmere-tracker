import '@testing-library/jest-dom'

// jsdom does not provide a `fetch` global. Define a default stub so component
// tests can `jest.spyOn(global, 'fetch')` or override it per test. A plain
// function (not jest.fn()) keeps this file safe under `next build`'s typecheck,
// which does not have the jest runtime value in scope. Route-handler tests that
// need the real Web Request/Response APIs use `@jest-environment node`.
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = (() =>
    Promise.reject(new Error('fetch is not mocked in this test'))) as unknown as typeof fetch
}

// jsdom does not implement window.matchMedia. The chat composer uses it to
// detect touch devices via `(pointer: coarse)`, so Enter-to-send only
// applies on desktop. A plain object (not jest.fn()) keeps this file safe
// under `next build`'s typecheck, same reasoning as the fetch stub above.
// Defaults to "not matching" — tests run as if on a fine-pointer (desktop)
// device, matching the existing Enter-to-send test coverage.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
