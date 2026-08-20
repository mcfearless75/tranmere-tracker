// Push notification display + tap-to-open handling for the service worker.
// Wired into the generated public/sw.js via next.config.js's `importScripts`
// option — NOT auto-injected by next-pwa. Without that config key this file
// (or its old location, worker/index.js) is dead code: subscriptions and
// server-side sends can both succeed while the browser silently has nothing
// listening for the 'push' event.
self.addEventListener('push', event => {
  if (!event.data) return
  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Tranmere Tracker', body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

// The push service (behind pushManager, e.g. FCM for Chrome) can invalidate
// and rotate a subscription on its own — expiry, storage pressure, browser
// sync — with no user action and no 'push' event to piggyback on. Without
// this handler that device silently stops receiving pushes forever; the only
// signal anyone gets is a growing pile of dead rows that /api/push/send's
// 404/410 pruning slowly cleans up. Re-subscribing here, in the SW, is the
// only place this event fires — it does not reach page/client JS at all.
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(resubscribe(event.oldSubscription))
})

async function resubscribe(oldSubscription) {
  try {
    // Reuse the same VAPID key the old subscription was created with where
    // the browser exposes it (Chrome does); fall back to fetching it, same
    // as the page-side registerWebPush in PushOptIn.tsx.
    let applicationServerKey = oldSubscription?.options?.applicationServerKey ?? null
    if (!applicationServerKey) {
      const res = await fetch('/api/push/vapid-key')
      const json = await res.json()
      if (json?.key) applicationServerKey = urlBase64ToUint8Array(json.key)
    }
    if (!applicationServerKey) return

    const newSubscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    // Best effort: the SW has no page context to react to failure, and the
    // old row (if the endpoint actually changed) is naturally pruned server-side
    // the next time a send is attempted against it.
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSubscription.toJSON()),
    })
  } catch {
    // Nothing more to do — see comment above.
  }
}

// Duplicated from components/PushOptIn.tsx: this file is loaded via
// next.config.js's `importScripts`, not bundled, so it can't import from the
// app's TypeScript source.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}
