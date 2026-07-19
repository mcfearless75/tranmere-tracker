'use client'

// Recharts is heavy — load it client-side only, on demand
import dynamic from 'next/dynamic'

export type { ZoneRow } from './ZoneBarsInner'

export const ZoneBars = dynamic(
  () => import('./ZoneBarsInner').then(m => m.ZoneBars),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-gray-100" />,
  }
)
