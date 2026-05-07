'use client'

import { useEffect, useState } from 'react'
import { isNative, getPlatform } from '@/lib/native'

type State = 'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported' | 'error'

export function PushOptIn() {
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isNative()) {
      // On native, check current permission state and auto-register silently
      checkAndRegisterNative(true).catch(() => {})
      return
    }

    // Web path
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    if (Notification.permission === 'granted') {
      registerWebPush(true).catch(() => {})
    }
  }, [])

  // ─── Native (Capacitor) path ────────────────────────────────────────────────

  async function checkAndRegisterNative(silent = false): Promise<boolean> {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')

      const permStatus = await PushNotifications.checkPermissions()

      if (permStatus.receive === 'denied') {
        if (!silent) setState('denied')
        return false
      }

      if (permStatus.receive !== 'granted') {
        // Not yet requested — only proceed silently if we shouldn't prompt
        if (silent) return false
        const requested = await PushNotifications.requestPermissions()
        if (requested.receive !== 'granted') {
          setState(requested.receive === 'denied' ? 'denied' : 'idle')
          return false
        }
      }

      await PushNotifications.register()

      // Listen for the registration token once
      await new Promise<void>((resolve, reject) => {
        PushNotifications.addListener('registration', async (token) => {
          try {
            const res = await fetch('/api/push/native-register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: token.value, platform: getPlatform() }),
            })
            if (!res.ok) throw new Error('Server rejected token')
            setState('subscribed')
            resolve()
          } catch (e) {
            reject(e)
          }
        })

        PushNotifications.addListener('registrationError', (err) => {
          reject(new Error(err.error))
        })

        // Timeout safety
        setTimeout(() => reject(new Error('Token registration timed out')), 20000)
      })

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

  // ─── Web push path ───────────────────────────────────────────────────────────

  async function registerWebPush(silent = false): Promise<boolean> {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) {
      if (!silent) {
        setErrorMsg('Push configuration missing — contact support.')
        setState('error')
      }
      return false
    }

    try {
      let reg = await navigator.serviceWorker.getRegistration('/')
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      }

      if (!reg.active) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

        await Promise.race([
          new Promise<void>(resolve => {
            navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
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

        reg = (await navigator.serviceWorker.getRegistration('/')) ?? reg
      }

      const existing = await reg.pushManager.getSubscription()
      if (existing) {
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

  // ─── Click handler ───────────────────────────────────────────────────────────

  async function handleClick() {
    setState('loading')
    setErrorMsg('')

    if (isNative()) {
      await checkAndRegisterNative(false)
      return
    }

    const perm = await Notification.requestPermission()
    if (perm === 'denied') { setState('denied'); return }
    if (perm !== 'granted') { setState('idle'); return }
    await registerWebPush(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

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
