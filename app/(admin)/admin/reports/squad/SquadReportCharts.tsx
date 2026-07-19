'use client'

// Recharts is heavy — load it client-side only, on demand
import dynamic from 'next/dynamic'

export const SquadReportCharts = dynamic(
  () => import('./SquadReportChartsInner').then(m => m.SquadReportCharts),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-2xl bg-gray-100" />,
  }
)
