import { useEffect } from 'react'

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
 * Confirmed live again 2026-09-10 (Vercel runtime errors, 148 occurrences
 * over 3 weeks, still recurring the day this comment was written — this fix
 * demonstrably wasn't closing the gap): WebKit (iPhone Safari) throws a
 * completely different message for the exact same corrupted-router-state
 * condition — "null is not an object (evaluating 't.parallelRoutes.get')" —
 * which the original check never matched. Every affected Safari user's
 * "Try again" was silently calling the broken `reset()` this whole time.
 * Added 'parallelRoutes' (Next's own internal term, safe to match — not
 * generic app vocabulary). Deliberately NOT matching WebKit's other, fully
 * generic phrasing for this same crash ("Right side of assignment cannot be
 * destructured") — that string carries no app-specific signal and would
 * reclassify any unrelated null-destructure bug anywhere in the app as
 * "reload, don't reset."
 *
 * Every app/**\/error.tsx boundary should route its "Try again" button
 * through this instead of calling `reset` directly, so the one error class
 * `reset()` cannot fix gets a button that actually works.
 */
export function isRouterInternalsCrash(error: Error): boolean {
  const msg = error.message ?? ''
  return (
    msg.includes('parallelRouterKey') ||
    msg.includes('parallelRoutes') ||
    msg.includes('Minified React error #423')
  )
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

/**
 * The gap `resetOrReload` alone still leaves open: it only runs when the
 * user notices the "Something went wrong" screen and taps "Try again"
 * themselves. For every other crash class that's the right call — a real
 * app error deserves a chance to `reset()` in place, and a human should
 * decide whether to retry. But the router-internals crash isn't like that:
 * it is 100% deterministic (always the same cause, always the same fix —
 * reload, never `reset()`), so there is no reason to make the user drive
 * the recovery for it. This hook closes that gap by running the recovery
 * the instant the boundary mounts, so the tab self-heals with no tap
 * required — the same self-healing UX ServiceWorkerUpdateReload.tsx already
 * gives a still-open tab for the OTHER trigger of this same crash class.
 *
 * Ordinary errors are untouched here — left for the user to dismiss via the
 * boundary's own "Try again" button, which still calls `resetOrReload` on
 * click exactly as before.
 */
export function useAutoRecoverFromRouterCrash(
  error: Error,
  reset: () => void,
  /** Overridable only for tests — jsdom's window.location can't be stubbed. */
  reload: () => void = () => window.location.reload(),
): void {
  useEffect(() => {
    if (isRouterInternalsCrash(error)) {
      reload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset is intentionally
    // not called here (see comment above); including it would not change behavior
    // but including `reload`'s fresh-closure default would refire this every render.
  }, [error])
}
