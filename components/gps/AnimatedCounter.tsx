'use client'

import { useEffect, useState } from 'react'

export function AnimatedCounter({
  value,
  decimals = 0,
  suffix = '',
  duration = 1200,
}: {
  value: number
  decimals?: number
  suffix?: string
  duration?: number
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let start: number | null = null
    let raf: number
    const from = 0
    const to = value
    const step = (t: number) => {
      if (start === null) start = t
      const progress = Math.min((t - start) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (to - from) * eased)
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{display.toFixed(decimals)}{suffix}</>
}
