'use client'

// Recharts is heavy — load it client-side only, on demand (same pattern as
// components/charts/AttendanceBar.tsx).
import dynamic from 'next/dynamic'

export const PhaseCompletionChart = dynamic(
  () => import('./CheckInHealthChartsInner').then(m => m.PhaseCompletionChart),
  {
    ssr: false,
    loading: () => <div className="h-40 w-full animate-pulse rounded-lg bg-gray-100" />,
  }
)

export const FlagBreakdownChart = dynamic(
  () => import('./CheckInHealthChartsInner').then(m => m.FlagBreakdownChart),
  {
    ssr: false,
    loading: () => <div className="h-40 w-full animate-pulse rounded-lg bg-gray-100" />,
  }
)
