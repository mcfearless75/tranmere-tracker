'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

/**
 * Re-fetches the server GPS page. Runs on first paint and whenever the tab /
 * PWA comes back to the foreground so opening GPS never needs a manual tap.
 */
export function GpsRefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [justUpdated, setJustUpdated] = useState(false)
  const lastAt = useRef(0)

  function refresh() {
    const now = Date.now()
    if (now - lastAt.current < 800) return
    lastAt.current = now
    startTransition(() => {
      router.refresh()
      setJustUpdated(true)
      window.setTimeout(() => setJustUpdated(false), 1200)
    })
  }

  useEffect(() => {
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const onPageShow = () => refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onPageShow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      aria-label="Refresh GPS data"
      title={pending ? 'Refreshing' : 'Refresh'}
      className="inline-flex items-center justify-center rounded-full p-2 text-tranmere-blue/70 active:bg-blue-50 disabled:opacity-60"
    >
      <RefreshCw size={16} className={pending ? 'animate-spin' : ''} />
      <span className="sr-only">{pending ? 'Refreshing' : justUpdated ? 'Updated' : 'Refresh'}</span>
    </button>
  )
}
