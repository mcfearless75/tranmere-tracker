/**
 * Next's error-boundary `reset()` re-renders the crashed segment in place —
 * correct for an ordinary render error, but useless for the router-internals
 * crash a deploy-boundary service-worker swap produces ("Cannot destructure
 * property 'parallelRouterKey' of 'e' as it is null", surfaced to users as
 * minified React error #423 — see ServiceWorkerUpdateReload.tsx for the root
 * cause). That corruption lives in Next's internal router state, which
 * `reset()` never touches, so every "Try again" click re-renders the same
 * broken state and the user stays stuck.
 *
 * Confirmed live 2026-09-07: clicking "Try again" on this exact error left
 * the page broken; a real navigation (full reload) fixed it immediately.
 *
 * Every app/**\/error.tsx boundary should route its "Try again" button
 * through this instead of calling `reset` directly, so the one error class
 * `reset()` cannot fix gets a button that actually works.
 */
export function isRouterInternalsCrash(error: Error): boolean {
  const msg = error.message ?? ''
  return msg.includes('parallelRouterKey') || msg.includes('Minified React error #423')
}

export function resetOrReload(
  error: Error,
  reset: () => void,
  /** Overridable only for tests — jsdom's window.location can't be stubbed. */
  reload: () => void = () => window.location.reload(),
): void {
  if (isRouterInternalsCrash(error)) {
    reload()
  } else {
    reset()
  }
}
