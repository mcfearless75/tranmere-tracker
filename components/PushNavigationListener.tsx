'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isNative } from '@/lib/native'

/**
 * Native-only: navigates to the notification's target page when the user
 * taps a push notification.
 *
 * Deliberately mounted in the root layout, not alongside PushOptIn — PushOptIn
 * only renders on a couple of dashboard pages, so a listener attached there
 * would miss a tap that opens the app fresh (killed-app / background launch)
 * on any other page. This has to be alive for the whole app lifetime.
 *
 * The `url` comes from the FCM data payload set server-side in
 * lib/firebase-admin.ts (`data: { url: notification.url }`).
 */
export function PushNavigationListener() {
  const router = useRouter()

  useEffect(() => {
    if (!isNative()) return

    let cancelled = false
    let handle: { remove: () => void } | undefined

    import('@capacitor/push-notifications').then(({ PushNotifications }) => {
      if (cancelled) return
      PushNotifications.addListener('pushNotificationActionPerformed', action => {
        const url = action.notification?.data?.url
        if (typeof url === 'string' && url.startsWith('/')) {
          router.push(url)
        }
      }).then(h => {
        if (cancelled) h.remove()
        else handle = h
      })
    }).catch(() => {})

    return () => {
      cancelled = true
      handle?.remove()
    }
  }, [router])

  return null
}
