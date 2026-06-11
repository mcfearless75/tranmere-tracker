'use client'

import { useCallback, useEffect, useState } from 'react'
import { Share, SquarePlus, MoreVertical, X, Smartphone, Download } from 'lucide-react'
import {
  detectPlatform,
  isIpadOs,
  shouldAutoShowGuide,
  canOfferInstall,
  INSTALL_GUIDE_SEEN_KEY,
  type InstallPlatform,
} from '@/lib/pwa/installUtils'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let promptListenerAttached = false

function attachPromptListener() {
  if (promptListenerAttached || typeof window === 'undefined') return
  promptListenerAttached = true
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
  })
}

function getContext() {
  const ua = navigator.userAgent
  const platform: InstallPlatform =
    isIpadOs(ua, navigator.maxTouchPoints ?? 0) ? 'ios' : detectPlatform(ua)
  const nav = navigator as Navigator & { standalone?: boolean }
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  const isNativeApp = cap?.isNativePlatform?.() === true
  return { platform, isStandalone, isNativeApp }
}

/**
 * One-time "add to home screen" walkthrough, shown after login on mobile
 * browsers only (never in the installed PWA or the native app). Re-openable
 * any time via <InstallAppButton />.
 */
export function InstallGuide() {
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<InstallPlatform>('other')

  useEffect(() => {
    attachPromptListener()
    const ctx = getContext()
    setPlatform(ctx.platform)
    const hasSeenGuide = localStorage.getItem(INSTALL_GUIDE_SEEN_KEY) === '1'
    if (shouldAutoShowGuide({ ...ctx, hasSeenGuide })) setOpen(true)
  }, [])

  const dismiss = useCallback(() => {
    localStorage.setItem(INSTALL_GUIDE_SEEN_KEY, '1')
    setOpen(false)
  }, [])

  if (!open) return null
  return <InstallModal platform={platform} onClose={dismiss} onSwitchPlatform={setPlatform} />
}

/** Small button that re-opens the install guide — for users who skipped it. */
export function InstallAppButton({ className = '' }: { className?: string }) {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<InstallPlatform>('other')

  useEffect(() => {
    attachPromptListener()
    const ctx = getContext()
    setPlatform(ctx.platform)
    setVisible(canOfferInstall(ctx))
  }, [])

  if (!visible) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-tranmere-blue/30 text-tranmere-blue px-3 py-2 text-xs font-semibold hover:bg-blue-50 transition-colors ${className}`}
      >
        <Smartphone size={14} /> Install app
      </button>
      {open && (
        <InstallModal
          platform={platform}
          onClose={() => {
            localStorage.setItem(INSTALL_GUIDE_SEEN_KEY, '1')
            setOpen(false)
          }}
          onSwitchPlatform={setPlatform}
        />
      )}
    </>
  )
}

function InstallModal({
  platform,
  onClose,
  onSwitchPlatform,
}: {
  platform: InstallPlatform
  onClose: () => void
  onSwitchPlatform: (p: InstallPlatform) => void
}) {
  const [installing, setInstalling] = useState(false)

  async function nativeInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        deferredPrompt = null
        onClose()
      }
    } finally {
      setInstalling(false)
    }
  }

  const showIos = platform !== 'android'
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Install the app">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-tranmere-blue">Add to your home screen</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Install Tranmere Tracker like an app — one tap to open, full screen, with notifications.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Platform switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => onSwitchPlatform('ios')}
            className={`rounded-lg py-2 ${showIos ? 'bg-white shadow text-tranmere-blue' : 'text-gray-500'}`}
          >
            iPhone / iPad
          </button>
          <button
            type="button"
            onClick={() => onSwitchPlatform('android')}
            className={`rounded-lg py-2 ${!showIos ? 'bg-white shadow text-tranmere-blue' : 'text-gray-500'}`}
          >
            Android
          </button>
        </div>

        {showIos ? (
          <ol className="space-y-3">
            <Step n={1}>
              Open this site in <strong>Safari</strong> (the guide only works there).
            </Step>
            <Step n={2}>
              Tap the <strong>Share</strong> button{' '}
              <span className="inline-flex items-center align-middle rounded bg-gray-100 px-1.5 py-0.5"><Share size={13} /></span>{' '}
              at the bottom of the screen.
            </Step>
            <Step n={3}>
              Scroll down and tap <strong>Add to Home Screen</strong>{' '}
              <span className="inline-flex items-center align-middle rounded bg-gray-100 px-1.5 py-0.5"><SquarePlus size={13} /></span>.
            </Step>
            <Step n={4}>
              Tap <strong>Add</strong> — the crest appears on your home screen.
            </Step>
          </ol>
        ) : (
          <div className="space-y-3">
            {deferredPrompt ? (
              <button
                type="button"
                onClick={nativeInstall}
                disabled={installing}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-tranmere-blue text-white py-3 text-sm font-semibold disabled:opacity-60"
              >
                <Download size={16} /> {installing ? 'Opening installer…' : 'Install now'}
              </button>
            ) : null}
            <ol className="space-y-3">
              <Step n={1}>
                Open this site in <strong>Chrome</strong>.
              </Step>
              <Step n={2}>
                Tap the <strong>menu</strong>{' '}
                <span className="inline-flex items-center align-middle rounded bg-gray-100 px-1.5 py-0.5"><MoreVertical size={13} /></span>{' '}
                in the top-right corner.
              </Step>
              <Step n={3}>
                Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>).
              </Step>
              <Step n={4}>
                Confirm — the crest appears on your home screen.
              </Step>
            </ol>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border-2 border-tranmere-blue text-tranmere-blue py-2.5 text-sm font-semibold hover:bg-blue-50"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-gray-700">
      <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-tranmere-blue text-white text-xs font-bold">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  )
}
