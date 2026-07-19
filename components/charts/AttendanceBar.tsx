'use client'

// Recharts is heavy — load it client-side only, on demand
import dynamic from 'next/dynamic'

export const AttendanceBar = dynamic(
  () => import('./AttendanceBarInner').then(m => m.AttendanceBar),
  {
    ssr: false,
    loading: () => <div className="h-44 w-full animate-pulse rounded-lg bg-gray-100" />,
  }
)
