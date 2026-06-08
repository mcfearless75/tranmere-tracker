'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import type { AttendanceWeek } from '@/lib/charts/attendanceUtils'

interface AttendanceBarProps {
  data: AttendanceWeek[]
  onBarClick: (week: AttendanceWeek) => void
}

function barColour(pct: number): string {
  if (pct >= 90) return '#10b981' // green
  if (pct >= 75) return '#f59e0b' // amber
  return '#ef4444'                // red
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const { attended, scheduled, pct } = payload[0].payload as AttendanceWeek
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      <p className="text-gray-600">{attended} of {scheduled} days</p>
      <p className="font-bold text-gray-900">{pct}%</p>
    </div>
  )
}

export function AttendanceBar({ data, onBarClick }: AttendanceBarProps) {
  if (data.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No attendance data available
      </p>
    )
  }

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: -20 }}
          onClick={(data: any) => {
            if (data?.activePayload?.[0]) onBarClick(data.activePayload[0].payload as AttendanceWeek)
          }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={90} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} />
          <Bar dataKey="pct" name="Attendance" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barColour(entry.pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
