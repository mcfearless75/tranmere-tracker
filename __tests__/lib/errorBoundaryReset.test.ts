import { renderHook } from '@testing-library/react'
import {
  isRouterInternalsCrash,
  resetOrReload,
  useAutoRecoverFromRouterCrash,
} from '@/lib/errorBoundaryReset'

describe('isRouterInternalsCrash', () => {
  it('recognizes the parallelRouterKey destructure crash', () => {
    const err = new Error("Cannot destructure property 'parallelRouterKey' of 'e' as it is null.")
    expect(isRouterInternalsCrash(err)).toBe(true)
  })

  it('recognizes the minified React #423 signature', () => {
    const err = new Error('Minified React error #423; visit https://react.dev/errors/423')
    expect(isRouterInternalsCrash(err)).toBe(true)
  })

  // Confirmed live 2026-09-10 via Vercel runtime errors: WebKit (iPhone Safari)
  // reports this exact same corrupted-router-state crash with a completely
  // different message than V8 — "null is not an object (evaluating
  // 't.parallelRoutes.get')" — which the original matcher never caught, so
  // affected Safari users never got the reload fix at all.
  it('recognizes the WebKit parallelRoutes-null variant', () => {
    const err = new Error("null is not an object (evaluating 't.parallelRoutes.get')")
    expect(isRouterInternalsCrash(err)).toBe(true)
  })

  it('does not flag an ordinary app error', () => {
    const err = new Error('Failed to fetch player stats')
    expect(isRouterInternalsCrash(err)).toBe(false)
  })

  // "Right side of assignment cannot be destructured" is also seen in
  // production for this exact crash on WebKit, but it's a fully generic
  // engine message with no app-specific content — matching it here would
  // reclassify ANY unrelated null-destructure bug anywhere in the app as
  // "reload, don't reset". Deliberately not matched; see errorBoundaryReset.ts.
  it('does not flag the generic WebKit destructure message (too broad to match safely)', () => {
    const err = new Error('Right side of assignment cannot be destructured')
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

describe('useAutoRecoverFromRouterCrash', () => {
  // Confirmed live: even for the crash messages the matcher DOES catch, every
  // error boundary only calls resetOrReload from the "Try again" button's
  // onClick — a user who never notices or taps that button stays stuck on
  // "Something went wrong" indefinitely. This hook closes that gap: the
  // router-internals crash is 100% deterministic (always the same fix,
  // always safe to run automatically), so the tab should self-heal the
  // moment the boundary mounts, without requiring the user to do anything.
  it('reloads automatically, with no user interaction, for the router-internals crash', () => {
    const reset = jest.fn()
    const reload = jest.fn()
    renderHook(() =>
      useAutoRecoverFromRouterCrash(
        new Error("Cannot destructure property 'parallelRouterKey' of 'e' as it is null."),
        reset,
        reload,
      ),
    )
    expect(reload).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })

  it('does nothing for an ordinary app error — left for the user to dismiss normally', () => {
    const reset = jest.fn()
    const reload = jest.fn()
    renderHook(() => useAutoRecoverFromRouterCrash(new Error('Failed to fetch player stats'), reset, reload))
    expect(reload).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
  })

  it('reloads at most once even if the hook re-runs for the same crash', () => {
    const reset = jest.fn()
    const reload = jest.fn()
    const err = new Error("Cannot destructure property 'parallelRouterKey' of 'e' as it is null.")
    const { rerender } = renderHook(({ error }) => useAutoRecoverFromRouterCrash(error, reset, reload), {
      initialProps: { error: err },
    })
    rerender({ error: err })
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
