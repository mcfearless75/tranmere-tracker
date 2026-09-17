'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Capacitor / iOS PWA do not reload on rubber-band overscroll. This listens
 * for a downward pull at the top of the nearest scroll area and then
 * router.refresh() + a soft location reload if still stale.
 */
export function PullToRefresh() {
  const router = useRouter()
  const startY = useRef(0)
  const armed = useRef(false)
  const fired = useRef(false)

  useEffect(() => {
    function atTop(target: EventTarget | null) {
      let n = target instanceof Element ? target : null
      while (n && n !== document.documentElement) {
        const style = window.getComputedStyle(n)
        const oy = style.overflowY
        if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && n.scrollTop > 4) return false
        n = n.parentElement
      }
      return (window.scrollY || document.documentElement.scrollTop || 0) < 4
    }

    function onStart(e: TouchEvent) {
      armed.current = atTop(e.target)
      fired.current = false
      startY.current = e.touches[0]?.clientY ?? 0
    }
    function onMove(e: TouchEvent) {
      if (!armed.current || fired.current) return
      const y = e.touches[0]?.clientY ?? 0
      if (y - startY.current > 72) {
        fired.current = true
        armed.current = false
        router.refresh()
      }
    }
    function onEnd() {
      armed.current = false
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [router])

  return null
}
