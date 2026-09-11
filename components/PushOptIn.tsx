'use client'

import { useEffect, useState } from 'react'
import { isNative, isAndroid, getPlatform } from '@/lib/native'
import { reportClientError } from '@/lib/reportClientError'

type State = 'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported' | 'error' | 'crashed'

// 2026-09-11: native PushNotifications.register() has been crashing the whole
// app on at least one Android device (100% repro, survives uninstall/reinstall
// and adding the missing Firebase SHA fingerprints — root cause still under
// investigation). Because permission stays 'granted' after the crash, the
// silent auto-register below was retrying — and re-crashing — on every single
// app launch, permanently bricking the app for anyone who hit it. This flag
// breaks that loop: set immediately before the risky native call, cleared by
// every JS-reachable outcome (success or a clean rejection). If it's still
// set on the next launch, the only way that happened is the process died
// before either of those could run — so skip the silent retry and leave it
// to an explicit tap instead.
const NATIVE_REGISTER_PENDING_KEY = 'tt-native-push-register-pending'

function isNativeRegisterPending(): boolean {
  try {
    return localStorage.getItem(NATIVE_REGISTER_PENDING_KEY) !== null
  } catch {
    return false
  }
}

function setNativeRegisterPending(): void {
  try {
    localStorage.setItem(NATIVE_REGISTER_PENDING_KEY, String(Date.now()))
  } catch {
    // best effort — worst case we lose crash-loop protection, not correctness
  }
}

function clearNativeRegisterPending(): void {
  try {
    localStorage.removeItem(NATIVE_REGISTER_PENDING_KEY)
  } catch {
    // ignore
  }
}

export function PushOptIn() {
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isNative()) {
      if (isNativeRegisterPending()) {
        // Previous attempt on this device never cleanly resolved — most
        // likely it crashed the app. Don't auto-retry; let the rest of the
        // app load and require an explicit tap before risking it again.
        setState('crashed')
        return
      }
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

      // Android 8+ silently drops sound/vibration on any notification posted
      // to a channel that doesn't exist yet — createChannel is idempotent, so
      // it's safe (and necessary) to call this on every registration, not
      // just the first. iOS has no channel concept; createChannel() there is
      // a no-op in the plugin, but skip it anyway to avoid relying on that.
      // Must match the channelId sent from lib/firebase-admin.ts.
      if (isAndroid()) {
        try {
          await PushNotifications.createChannel({
            id: 'messages',
            name: 'Messages & alerts',
            description: 'Chat messages, attendance and safeguarding alerts',
            importance: 4, // HIGH — required for heads-up + sound
            visibility: 1,
            vibration: true,
          })
        } catch {
          // Best effort — worst case the OS falls back to its default channel.
        }
      }

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

      // Attach listeners BEFORE calling register() — the native token event
      // can fire immediately, so a listener added afterwards may miss it.
      const tokenRegistered = new Promise<void>((resolve, reject) => {
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

      // Set immediately before the call that's been observed to crash the
      // app natively — see NATIVE_REGISTER_PENDING_KEY above. Every path out
      // of this function from here on (success below, or the catch block)
      // clears it; only a process death skips both.
      setNativeRegisterPending()
      await PushNotifications.register()
      await tokenRegistered
      clearNativeRegisterPending()

      return true
    } catch (err: unknown) {
      clearNativeRegisterPending()
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (!silent) {
        // Caught here, never thrown to a React error boundary — without this
        // an explicit tap-to-enable failure leaves zero server-side trace.
        reportClientError(err instanceof Error ? err : new Error(msg), 'push-opt-in-native')
        setErrorMsg(`Could not enable notifications: ${msg}`)
        setState('error')
      }
      return false
    }
  }

  // ─── Web push path ───────────────────────────────────────────────────────────

  async function registerWebPush(silent = false): Promise<boolean> {
    // Prefer the build-time env var, but fall back to fetching the key from
    // the server — NEXT_PUBLIC_VAPID_PUBLIC_KEY was never configured in
    // Vercel, which made this early-return fire for every user and web push
    // silently never work.
    let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) {
      try {
        const res = await fetch('/api/push/vapid-key')
        const json = await res.json() as { key: string | null }
        publicKey = json.key ?? undefined
      } catch {
        // fall through to the missing-key error below
      }
    }
    if (!publicKey) {
      if (!silent) {
        setErrorMsg('Push configuration missing — contact support.')
        setState('error')
      }
      return false
    }

    try {
      // Ensure SW is registered — next-pwa does this on page load, but may
      // not have completed if the user taps the button very quickly.
      if (!await navigator.serviceWorker.getRegistration('/')) {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      }

      // navigator.serviceWorker.ready is the reliable, race-condition-free way
      // to wait for an active SW. The previous statechange approach had a gap
      // on Android where the SW could transition between install → activating
      // before the listener was attached, leaving sw null and the race never
      // resolving → the 15 s timeout fired.
      //
      // 2026-09-08: reproduced live — activation is gated on the FULL
      // precache finishing (workbox's install handler awaits it before the
      // SW can activate), and this build's precache manifest is 172 files /
      // ~4.5MB. Every single one of those 172 URLs was confirmed valid
      // (zero 404s) — a genuinely cold install (no browser HTTP cache, no
      // warm CDN edge for this deploy's hashed filenames yet) can just take
      // longer than 20s to pull all of it down, especially on a slower
      // morning WiFi/cellular connection. That's not a failure, just slow —
      // 20s was too impatient and was reporting real-but-slow installs as
      // broken. A second attempt minutes later (warm cache) resolved in ~1ms.
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Service worker install timed out — try reloading the page and tapping this again')), 45000)
        ),
      ])

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
        // Caught here, never thrown to a React error boundary — without this
        // an explicit tap-to-enable failure leaves zero server-side trace.
        reportClientError(err instanceof Error ? err : new Error(msg), 'push-opt-in-web')
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
    <div className="w-full flex flex-col gap-2">
      {state === 'crashed' && (
        <div className="w-full text-sm bg-amber-50 border border-amber-200 text-amber-700 py-2 rounded-xl px-3 text-center">
          ⚠️ Notifications didn&apos;t enable properly last time on this device. You can try again below.
        </div>
      )}
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
          '🔔 Enable notifications'
        )}
      </button>
    </div>
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
