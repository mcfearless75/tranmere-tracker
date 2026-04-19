'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Download, Filter, Route, Gauge, Zap } from 'lucide-react'
import { toCSV, downloadCSV } from '@/lib/csv'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts'

type Student = { id: string; name: string | null; avatar_url: string | null }
type GpsRow = { player_id: string; session_date: string; session_label: string | null; total_distance_m: number | null; max_speed_kmh: number | null; sprint_count: number | null; player_load: number | null }
type MatchRow = { student_id: string; match_date: string; opponent: string; goals: number; assists: number; self_rating: number | null; minutes_played: number }

const DAYS = [7, 14, 30, 90] as const

export function SquadReportClient({ students, gps, matches }: { students: Student[]; gps: GpsRow[]; matches: MatchRow[] }) {
  const [window, setWindow] = useState<(typeof DAYS)[number]>(30)

  const since = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - window); return d.toISOString().slice(0, 10)
  }, [window])

  const filteredGps = useMemo(() => gps.filter(g => g.session_date >= since), [gps, since])
  const filteredMatches = useMemo(() => matches.filter(m => m.match_date >= since), [matches, since])

  // Per-player aggregation
  const playerStats = useMemo(() => students.map(s => {
    const pGps = filteredGps.filter(g => g.player_id === s.id)
    const pMatches = filteredMatches.filter(m => m.student_id === s.id)
    return {
      student: s,
      sessions: pGps.length,
      totalDistance: pGps.reduce((sum, g) => sum + (g.total_distance_m ?? 0), 0),
      avgDistance: pGps.length > 0 ? pGps.reduce((sum, g) => sum + (g.total_distance_m ?? 0), 0) / pGps.length : 0,
      maxSpeed: Math.max(0, ...pGps.map(g => g.max_speed_kmh ?? 0)),
      avgSprints: pGps.length > 0 ? pGps.reduce((sum, g) => sum + (g.sprint_count ?? 0), 0) / pGps.length : 0,
      avgLoad: pGps.length > 0 ? pGps.reduce((sum, g) => sum + (g.player_load ?? 0), 0) / pGps.length : 0,
      matches: pMatches.length,
      goals: pMatches.reduce((s, m) => s + m.goals, 0),
      assists: pMatches.reduce((s, m) => s + m.assists, 0),
      avgRating: pMatches.filter(m => m.self_rating).length > 0
        ? pMatches.filter(m => m.self_rating).reduce((s, m) => s + (m.self_rating ?? 0), 0) / pMatches.filter(m => m.self_rating).length
        : null,
    }
  }).filter(p => p.sessions > 0 || p.matches > 0), [students, filteredGps, filteredMatches])

  // Team baselines
  const activePlayers = playerStats.filter(p => p.sessions > 0)
  const teamAvg = {
    distance: activePlayers.length > 0 ? activePlayers.reduce((s, p) => s + p.avgDistance, 0) / activePlayers.length : 0,
    maxSpeed: activePlayers.length > 0 ? activePlayers.reduce((s, p) => s + p.maxSpeed, 0) / activePlayers.length : 0,
    sprints: activePlayers.length > 0 ? activePlayers.reduce((s, p) => s + p.avgSprints, 0) / activePlayers.length : 0,
  }

  // Chart data — distance vs team baseline
  const distanceChart = [...activePlayers]
    .sort((a, b) => b.avgDistance - a.avgDistance)
    .map(p => ({
      name: p.student.name?.split(' ').slice(-1)[0] ?? '',
      avgKm: +(p.avgDistance / 1000).toFixed(2),
      belowBaseline: p.avgDistance < teamAvg.distance,
    }))

  // Speed chart
  const speedChart = [...activePlayers]
    .sort((a, b) => b.maxSpeed - a.maxSpeed)
    .map(p => ({
      name: p.student.name?.split(' ').slice(-1)[0] ?? '',
      speed: p.maxSpeed,
      belowBaseline: p.maxSpeed < teamAvg.maxSpeed,
    }))

  function exportCSV() {
    const rows = playerStats.map(p => ({
      Player: p.student.name ?? '',
      'Sessions': p.sessions,
      'Total Distance (km)': (p.totalDistance / 1000).toFixed(2),
      'Avg Distance (km)': (p.avgDistance / 1000).toFixed(2),
      'Max Speed (km/h)': p.maxSpeed.toFixed(1),
      'Avg Sprints': p.avgSprints.toFixed(1),
      'Avg Player Load': p.avgLoad.toFixed(0),
      'Matches': p.matches,
      'Goals': p.goals,
      'Assists': p.assists,
      'Avg Self Rating': p.avgRating?.toFixed(1) ?? '',
    }))
    downloadCSV(`squad-performance-${window}d-${new Date().toISOString().slice(0,10)}`, toCSV(rows))
  }

  return (
    <div className="space-y-5">
      {/* FILTERS */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs">
            {DAYS.map(d => (
              <button
                key={d}
                onClick={() => setWindow(d)}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  window === d ? 'bg-white text-tranmere-blue shadow-sm' : 'text-gray-500'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">· {activePlayers.length} active players</span>
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 rounded-lg bg-tranmere-blue text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-900"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* TEAM KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Team Avg Distance" value={`${(teamAvg.distance / 1000).toFixed(2)} km`} icon={<Route size={14} />} />
        <KpiCard label="Team Avg Top Speed" value={`${teamAvg.maxSpeed.toFixed(1)} km/h`} icon={<Gauge size={14} />} />
        <KpiCard label="Team Avg Sprints" value={teamAvg.sprints.toFixed(1)} icon={<Zap size={14} />} />
        <KpiCard label="GPS Sessions" value={filteredGps.length.toString()} />
      </div>

      {/* DISTANCE CHART */}
      {distanceChart.length > 0 && (
        <div className="rounded-2xl border bg-white p-5">
          <p className="font-semibold mb-1">Average Distance Per Session</p>
          <p className="text-xs text-muted-foreground mb-3">
            Red line = team baseline ({(teamAvg.distance / 1000).toFixed(2)} km). Bars below the line need conditioning focus.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distanceChart} margin={{ top: 8, right: 8, bottom: 40, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} unit=" km" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', fontSize: 12 }} />
                <ReferenceLine y={+(teamAvg.distance / 1000).toFixed(2)} stroke="#dc2626" strokeDasharray="4 4" />
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

      {/* SPEED CHART */}
      {speedChart.length > 0 && (
        <div className="rounded-2xl border bg-white p-5">
          <p className="font-semibold mb-1">Top Speed Ranking</p>
          <p className="text-xs text-muted-foreground mb-3">
            Red line = team baseline ({teamAvg.maxSpeed.toFixed(1)} km/h).
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={speedChart} margin={{ top: 8, right: 8, bottom: 40, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} unit=" km/h" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', fontSize: 12 }} />
                <ReferenceLine y={+teamAvg.maxSpeed.toFixed(1)} stroke="#dc2626" strokeDasharray="4 4" />
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

      {/* PLAYER TABLE */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Player</th>
                <th className="px-4 py-2 text-right">Sessions</th>
                <th className="px-4 py-2 text-right">Avg km</th>
                <th className="px-4 py-2 text-right">Top Speed</th>
                <th className="px-4 py-2 text-right">Avg Sprints</th>
                <th className="px-4 py-2 text-right">Matches</th>
                <th className="px-4 py-2 text-right">G/A</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map(p => (
                <tr key={p.student.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/admin/students/${p.student.id}`} className="text-tranmere-blue hover:underline font-medium">
                      {p.student.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">{p.sessions}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {p.avgDistance > 0 ? (p.avgDistance / 1000).toFixed(2) : '—'}
                    {p.avgDistance > 0 && p.avgDistance < teamAvg.distance && (
                      <span className="ml-1 text-xs text-red-500">▼</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{p.maxSpeed > 0 ? p.maxSpeed.toFixed(1) : '—'}</td>
                  <td className="px-4 py-2 text-right">{p.avgSprints > 0 ? p.avgSprints.toFixed(1) : '—'}</td>
                  <td className="px-4 py-2 text-right">{p.matches}</td>
                  <td className="px-4 py-2 text-right font-medium">{p.goals}G {p.assists}A</td>
                </tr>
              ))}
              {playerStats.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No data in the selected window.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-800 p-4">
      <p className="text-xs font-medium flex items-center gap-1.5">{icon}{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  )
}
