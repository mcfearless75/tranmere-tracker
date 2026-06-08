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
