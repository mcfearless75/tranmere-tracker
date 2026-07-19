'use client'

// Recharts is heavy — load it client-side only, on demand
import dynamic from 'next/dynamic'

export type { TrendPoint } from './TrendChartInner'

export const TrendChart = dynamic(
  () => import('./TrendChartInner').then(m => m.TrendChart),
  {
    ssr: false,
    loading: () => <div className="h-44 w-full animate-pulse rounded-lg bg-gray-100" />,
  }
)
