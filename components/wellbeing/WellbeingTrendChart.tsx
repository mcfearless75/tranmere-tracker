'use client'

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { SurveyTrendPoint } from '@/lib/wellbeing/wellbeingUtils'

interface Props {
  data: SurveyTrendPoint[]
}

export function WellbeingTrendChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <p className="text-center text-sm text-muted-foreground py-12">
        Complete a couple more check-ins to see your trend appear here.
      </p>
    )
  }

  const chartData = data.map(d => ({
    ...d,
    label: new Date(d.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  }))

  return (
    <div className="h-56 w-full" title="Your wellbeing trend">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip formatter={(v) => [`${v}/5`, 'Avg']} labelFormatter={(label) => label} />
          <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
