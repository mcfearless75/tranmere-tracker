'use client'

// Recharts is heavy — load it client-side only, on demand
import dynamic from 'next/dynamic'

export type { RadarData } from './PlayerRadarInner'

export const PlayerRadar = dynamic(
  () => import('./PlayerRadarInner').then(m => m.PlayerRadar),
  {
    ssr: false,
    loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-gray-100" />,
  }
)
