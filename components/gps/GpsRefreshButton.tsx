'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

/**
 * iOS Home Screen PWAs have no pull-to-refresh. This button re-fetches the
 * server GPS page. Also refreshes when the app comes back to the foreground
 * so opening the icon after an import does not stay stuck on stale HTML.
 */
export function GpsRefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [justUpdated, setJustUpdated] = useState(false)

  function refresh() {
    startTransition(() => {
      router.refresh()
      setJustUpdated(true)
      window.setTimeout(() => setJustUpdated(false), 1600)
    })
  }

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      aria-label="Refresh GPS data"
      className="inline-flex items-center gap-1.5 rounded-xl border border-tranmere-blue/20 bg-white px-3 py-2 text-sm font-medium text-tranmere-blue shadow-sm active:bg-blue-50 disabled:opacity-60"
    >
      <RefreshCw size={15} className={pending ? 'animate-spin' : ''} />
      {pending ? 'Refreshing…' : justUpdated ? 'Updated' : 'Refresh'}
    </button>
  )
}
