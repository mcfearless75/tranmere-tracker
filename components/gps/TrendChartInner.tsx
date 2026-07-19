'use client'

import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts'

export type TrendPoint = {
  date: string       // formatted short
  distance: number   // km
  topSpeed: number   // km/h
  sprints: number
}

export function TrendChart({ data, metric }: {
  data: TrendPoint[]
  metric: 'distance' | 'topSpeed' | 'sprints'
}) {
  const config = {
    distance: { label: 'Distance (km)', color: '#003087', stroke: '#003087' },
    topSpeed: { label: 'Top Speed (km/h)', color: '#f97316', stroke: '#f97316' },
    sprints:  { label: 'Sprints',         color: '#10b981', stroke: '#10b981' },
  }[metric]

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`g-${metric}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={config.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={config.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', fontSize: 12 }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey={metric}
            name={config.label}
            stroke={config.stroke}
            strokeWidth={2.5}
            fill={`url(#g-${metric})`}
            animationDuration={1200}
            dot={{ fill: config.color, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
