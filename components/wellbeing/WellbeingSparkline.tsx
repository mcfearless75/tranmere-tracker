'use client'

// Recharts is heavy — load it client-side only, on demand
import dynamic from 'next/dynamic'

export const WellbeingSparkline = dynamic(
  () => import('./WellbeingSparklineInner').then(m => m.WellbeingSparkline),
  {
    ssr: false,
    loading: () => <div className="w-20 h-8 animate-pulse rounded bg-gray-100" />,
  }
)
