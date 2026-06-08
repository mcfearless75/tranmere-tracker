'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { AcademicCounts } from '@/lib/charts/academicUtils'

type SliceKey = 'complete' | 'inProgress' | 'notStarted'

interface AcademicPieProps {
  data: AcademicCounts
  onSliceClick: (status: SliceKey) => void
}

const SLICES: { key: SliceKey; label: string; color: string }[] = [
  { key: 'complete',   label: 'Complete',    color: '#10b981' },
  { key: 'inProgress', label: 'In Progress', color: '#f59e0b' },
  { key: 'notStarted', label: 'Not Started', color: '#e5e7eb' },
]

export function AcademicPie({ data, onSliceClick }: AcademicPieProps) {
  const total = data.complete + data.inProgress + data.notStarted

  if (total === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No academic data available
      </p>
    )
  }

  const chartData = SLICES.map(s => ({ ...s, value: data[s.key] }))

  return (
    <div className="flex items-center gap-4">
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius="55%"
              outerRadius="90%"
              paddingAngle={2}
              onClick={({ key }) => onSliceClick(key as SliceKey)}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value ?? 0} units`, name as string]}
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with counts */}
      <div className="flex flex-col gap-2 text-sm">
        {SLICES.map(s => (
          <button
            key={s.key}
            onClick={() => onSliceClick(s.key)}
            className="flex items-center gap-2 text-left hover:opacity-70 transition-opacity"
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-gray-600 text-xs">{s.label}</span>
            <span className="font-bold text-gray-900 ml-auto pl-2">{data[s.key]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
