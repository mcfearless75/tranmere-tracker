'use client'

import { useEffect, useState } from 'react'

type State = 'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported' | 'error'

export function PushOptIn() {
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    // Auto-register silently if already granted + not yet subscribed
    if (Notification.permission === 'granted') {
      registerPush(true).catch(() => {})
    }
  }, [])

  async function registerPush(silent = false): Promise<boolean> {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) {
      if (!silent) {
        setErrorMsg('Push configuration missing — contact support.')
        setState('error')
      }
      return false
    }

    try {
      // Ensure service worker is registered — next-pwa registers it but on mobile
      // it may not be active yet; register explicitly if needed
      let reg = await navigator.serviceWorker.getRegistration('/')
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      }

      // If no active SW, wait for one to activate
      if (!reg.active) {
        // Tell any waiting SW to skip waiting (next-pwa sets skipWaiting:true but
        // an old SW may block the new one from taking over on the first page load)
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

        await Promise.race([
          new Promise<void>(resolve => {
            // Primary signal: controllerchange fires when new SW takes control
            navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })

            // Backup: statechange on the currently installing/waiting SW
            const sw = reg!.installing ?? reg!.waiting
            if (sw) {
              sw.addEventListener('statechange', function handler() {
                if (sw.state === 'activated') {
                  sw.removeEventListener('statechange', handler)
                  resolve()
                }
              })
            }
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Service worker install timed out')), 15000)
          ),
        ])

        // Re-fetch now-active registration
        reg = (await navigator.serviceWorker.getRegistration('/')) ?? reg
      }

      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        // Re-send existing subscription to server in case it wasn't saved
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(existing.toJSON()),
        })
        setState('subscribed')
        return true
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })

      if (!res.ok) throw new Error('Server rejected subscription')
      setState('subscribed')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (!silent) {
        setErrorMsg(`Could not enable notifications: ${msg}`)
        setState('error')
      }
      return false
    }
  }

  async function handleClick() {
    setState('loading')
    setErrorMsg('')

    const perm = await Notification.requestPermission()
    if (perm === 'denied') {
      setState('denied')
      return
    }
    if (perm !== 'granted') {
      setState('idle')
      return
    }
    await registerPush(false)
  }

  if (state === 'unsupported' || state === 'denied') return null

  if (state === 'subscribed') {
    return (
      <div className="w-full text-sm bg-green-50 border border-green-200 text-green-700 font-medium py-3 rounded-xl flex items-center justify-center gap-2">
        ✅ Notifications enabled
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="w-full text-sm bg-red-50 border border-red-200 text-red-700 py-3 rounded-xl flex items-center justify-center gap-2 px-3 text-center">
        ⚠️ {errorMsg}
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="w-full text-sm bg-tranmere-gold text-tranmere-blue font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
    >
      {state === 'loading' ? (
        <>
          <span className="animate-spin inline-block w-4 h-4 border-2 border-tranmere-blue border-t-transparent rounded-full" />
          Enabling…
        </>
      ) : (
        '🔔 Enable deadline notifications'
      )}
    </button>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}
