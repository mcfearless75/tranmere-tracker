'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { GradeBreakdown } from '@/lib/academics/academicsUtils'

interface TooltipEntry {
  name?: string
  value?: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
}

interface AcademicsChartProps {
  breakdown: GradeBreakdown
}

const CHART_DATA_KEYS = [
  { key: 'pass' as const, label: 'Pass', color: '#22c55e' },
  { key: 'merit' as const, label: 'Merit', color: '#3b82f6' },
  { key: 'distinction' as const, label: 'Distinction', color: '#a855f7' },
  { key: 'notSubmitted' as const, label: 'Not submitted', color: '#d1d5db' },
]

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow px-3 py-2 text-xs">
      <span className="font-semibold text-gray-800">{item.name}</span>
      <span className="ml-2 text-gray-600">{item.value}</span>
    </div>
  )
}

export function AcademicsChart({ breakdown }: AcademicsChartProps) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0)

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No submissions yet
      </p>
    )
  }

  const data = CHART_DATA_KEYS
    .map(({ key, label, color }) => ({ name: label, value: breakdown[key], color }))
    .filter(d => d.value > 0)

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {CHART_DATA_KEYS.filter(d => breakdown[d.key] > 0).map(({ label, color, key }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
            {label} ({breakdown[key]})
          </div>
        ))}
      </div>
    </div>
  )
}
