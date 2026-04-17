'use client'

import { useEffect, useState } from 'react'

export function PushOptIn() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)

    // Auto-register if already granted
    if (Notification.permission === 'granted') {
      registerPush().catch(() => {})
    }
  }, [])

  async function registerPush() {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) return

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) return

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
  }

  async function requestPermission() {
    const perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm === 'granted') {
      await registerPush()
    }
  }

  // Don't render if unsupported or already granted/denied
  if (permission !== 'default') return null

  return (
    <button
      onClick={requestPermission}
      className="w-full text-sm bg-tranmere-gold text-tranmere-blue font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
    >
      🔔 Enable deadline notifications
    </button>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
