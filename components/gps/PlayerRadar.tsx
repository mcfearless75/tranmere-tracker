'use client'

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'

export type RadarData = {
  metric: string
  value: number        // 0-100 normalised
  raw: string          // display label
}

export function PlayerRadar({ data }: { data: RadarData[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="75%">
          <defs>
            <radialGradient id="radarFill">
              <stop offset="0%" stopColor="#003087" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#003087" stopOpacity={0.2} />
            </radialGradient>
          </defs>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: '#374151', fontSize: 11, fontWeight: 600 }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Player"
            dataKey="value"
            stroke="#003087"
            strokeWidth={2}
            fill="url(#radarFill)"
            animationDuration={1200}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}
            formatter={(_v, _n, entry: any) => [entry.payload.raw, entry.payload.metric]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
