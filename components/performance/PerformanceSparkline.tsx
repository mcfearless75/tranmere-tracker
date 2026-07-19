'use client'

// Recharts is heavy — load it client-side only, on demand
import dynamic from 'next/dynamic'

export const PerformanceSparkline = dynamic(
  () => import('./PerformanceSparklineInner').then(m => m.PerformanceSparkline),
  {
    ssr: false,
    loading: () => <div className="h-[100px] w-full animate-pulse rounded-lg bg-gray-100" />,
  }
)
