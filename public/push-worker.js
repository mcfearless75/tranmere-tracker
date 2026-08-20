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
