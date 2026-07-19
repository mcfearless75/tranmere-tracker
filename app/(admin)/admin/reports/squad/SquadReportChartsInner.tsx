'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts'

export type DistancePoint = { name: string; avgKm: number; belowBaseline: boolean }
export type SpeedPoint = { name: string; speed: number; belowBaseline: boolean }

interface SquadReportChartsProps {
  distanceChart: DistancePoint[]
  speedChart: SpeedPoint[]
  teamAvgDistance: number
  teamAvgMaxSpeed: number
}

const tooltipStyle = { borderRadius: 8, border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', fontSize: 12 }

export function SquadReportCharts({ distanceChart, speedChart, teamAvgDistance, teamAvgMaxSpeed }: SquadReportChartsProps) {
  return (
    <>
      {distanceChart.length > 0 && (
        <div className="rounded-2xl border bg-white p-5">
          <p className="font-semibold mb-1">Average Distance Per Session</p>
          <p className="text-xs text-muted-foreground mb-3">
            Red line = team baseline ({(teamAvgDistance / 1000).toFixed(2)} km). Bars below the line need conditioning focus.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distanceChart} margin={{ top: 8, right: 8, bottom: 40, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} unit=" km" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceLine y={+(teamAvgDistance / 1000).toFixed(2)} stroke="#dc2626" strokeDasharray="4 4" />
                <Bar dataKey="avgKm" radius={[4, 4, 0, 0]}>
                  {distanceChart.map((e, i) => (
                    <Cell key={i} fill={e.belowBaseline ? '#f87171' : '#003087'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {speedChart.length > 0 && (
        <div className="rounded-2xl border bg-white p-5">
          <p className="font-semibold mb-1">Top Speed Ranking</p>
          <p className="text-xs text-muted-foreground mb-3">
            Red line = team baseline ({teamAvgMaxSpeed.toFixed(1)} km/h).
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={speedChart} margin={{ top: 8, right: 8, bottom: 40, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} unit=" km/h" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceLine y={+teamAvgMaxSpeed.toFixed(1)} stroke="#dc2626" strokeDasharray="4 4" />
                <Bar dataKey="speed" radius={[4, 4, 0, 0]}>
                  {speedChart.map((e, i) => (
                    <Cell key={i} fill={e.belowBaseline ? '#fdba74' : '#f97316'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  )
}
