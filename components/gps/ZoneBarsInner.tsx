'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

export type ZoneRow = {
  date: string
  Walking: number
  Jogging: number
  Running: number
  HSR: number
  Sprinting: number
}

const COLOURS = {
  Walking:   '#dbeafe',
  Jogging:   '#93c5fd',
  Running:   '#3b82f6',
  HSR:       '#f97316',
  Sprinting: '#dc2626',
}

export function ZoneBars({ data }: { data: ZoneRow[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} unit="m" />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', fontSize: 12 }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          <Bar dataKey="Walking"   stackId="a" fill={COLOURS.Walking}   radius={[0, 0, 0, 0]} animationDuration={900} />
          <Bar dataKey="Jogging"   stackId="a" fill={COLOURS.Jogging}   radius={[0, 0, 0, 0]} animationDuration={900} />
          <Bar dataKey="Running"   stackId="a" fill={COLOURS.Running}   radius={[0, 0, 0, 0]} animationDuration={900} />
          <Bar dataKey="HSR"       stackId="a" fill={COLOURS.HSR}       radius={[0, 0, 0, 0]} animationDuration={900} />
          <Bar dataKey="Sprinting" stackId="a" fill={COLOURS.Sprinting} radius={[4, 4, 0, 0]} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
