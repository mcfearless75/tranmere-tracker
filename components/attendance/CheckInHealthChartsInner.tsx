'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

export type PhaseCompletionBar = { phase: string; pct: number }
export type FlagBreakdownBar = { category: string; count: number }

function completionColour(pct: number): string {
  if (pct >= 90) return '#10b981' // green
  if (pct >= 75) return '#f59e0b' // amber
  return '#ef4444'                // red
}

const CompletionTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const { pct } = payload[0].payload as PhaseCompletionBar
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="font-bold text-gray-900">{pct}%</p>
    </div>
  )
}

export function PhaseCompletionChart({ data }: { data: PhaseCompletionBar[] }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="phase" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip content={<CompletionTooltip />} />
          <ReferenceLine y={90} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} />
          <Bar dataKey="pct" name="Completion" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry, i) => (
              <Cell key={i} fill={completionColour(entry.pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const FlagTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const { count } = payload[0].payload as FlagBreakdownBar
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="font-bold text-gray-900">{count}</p>
    </div>
  )
}

export function FlagBreakdownChart({ data }: { data: FlagBreakdownBar[] }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip content={<FlagTooltip />} />
          <Bar dataKey="count" name="Flags" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
