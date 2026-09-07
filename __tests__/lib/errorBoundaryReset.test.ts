import { isRouterInternalsCrash, resetOrReload } from '@/lib/errorBoundaryReset'

describe('isRouterInternalsCrash', () => {
  it('recognizes the parallelRouterKey destructure crash', () => {
    const err = new Error("Cannot destructure property 'parallelRouterKey' of 'e' as it is null.")
    expect(isRouterInternalsCrash(err)).toBe(true)
  })

  it('recognizes the minified React #423 signature', () => {
    const err = new Error('Minified React error #423; visit https://react.dev/errors/423')
    expect(isRouterInternalsCrash(err)).toBe(true)
  })

  it('does not flag an ordinary app error', () => {
    const err = new Error('Failed to fetch player stats')
    expect(isRouterInternalsCrash(err)).toBe(false)
  })
})

describe('resetOrReload', () => {
  it('calls reset() for an ordinary error, not reload', () => {
    const reset = jest.fn()
    const reload = jest.fn()
    resetOrReload(new Error('Failed to fetch player stats'), reset, reload)
    expect(reset).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
  })

  // Regression: confirmed live 2026-09-07 — clicking "Try again" (reset())
  // on this exact router-internals crash left the page broken; only a real
  // reload fixed it.
  it('hard-reloads instead of calling reset() for the router-internals crash', () => {
    const reset = jest.fn()
    const reload = jest.fn()
    resetOrReload(new Error("Cannot destructure property 'parallelRouterKey' of 'e' as it is null."), reset, reload)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })
})
