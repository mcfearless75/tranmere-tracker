'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

interface SparklinePoint {
  date: string
  distanceKm: number
}

interface PerformanceSparklineProps {
  data: SparklinePoint[]
}

export function PerformanceSparkline({ data }: PerformanceSparklineProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[100px] text-xs text-muted-foreground">
        No GPS data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={data}>
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)} km`, 'Distance']}
          labelFormatter={(label) => label}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line
          type="monotone"
          dataKey="distanceKm"
          stroke="#1d4ed8"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
