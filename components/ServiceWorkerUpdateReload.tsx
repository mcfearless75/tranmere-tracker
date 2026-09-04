'use client'

import { useEffect } from 'react'

/**
 * next.config.js registers the PWA service worker with skipWaiting +
 * clientsClaim, so a NEW deployment's SW takes control of an already-open
 * tab immediately — but that tab is still running the OLD JS bundle in
 * memory. The next client-side navigation (or a background RSC refetch)
 * then gets a payload shaped for the new deployment handed to old React
 * internals, which throws things like "Cannot destructure property
 * 'parallelRouterKey' of 'e' as it is null" — a router/layout internals
 * crash, not a real app bug. Symptom: the global error boundary
 * ("Something went wrong") on a tab left open across a deploy.
 *
 * The standard fix: reload once when the active service worker changes
 * controller, so an open tab picks up the matching new bundle instead of
 * limping along on stale JS. Guarded so it only ever reloads once per tab
 * (`controllerchange` can otherwise fire more than once).
 */
export function ServiceWorkerUpdateReload({
  reload = () => window.location.reload(),
}: {
  /** Overridable only for tests — jsdom's window.location can't be stubbed. */
  reload?: () => void
} = {}) {
  useEffect(() => {
    if (!navigator.serviceWorker) return

    let reloaded = false
    const onControllerChange = () => {
      if (reloaded) return
      reloaded = true
      reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once listener; `reload`'s
    // default is a fresh closure per render and isn't meant to retrigger this.
  }, [])

  return null
}
