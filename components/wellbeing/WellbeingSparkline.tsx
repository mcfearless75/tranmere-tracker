'use client'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import type { SurveyTrendPoint } from '@/lib/wellbeing/wellbeingUtils'

interface Props {
  data: SurveyTrendPoint[]
}

export function WellbeingSparkline({ data }: Props) {
  if (data.length < 2) return null

  return (
    <div className="w-20 h-8" title="Wellbeing trend (last 3 surveys)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Tooltip
            contentStyle={{ fontSize: 10, padding: '2px 6px', borderRadius: 6 }}
            formatter={(v) => [`${v}/5`, 'Avg']}
            labelFormatter={() => ''}
          />
          <Line
            type="monotone"
            dataKey="avg"
            dot={false}
            strokeWidth={1.5}
            stroke="#3b82f6"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
