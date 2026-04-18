'use client'

import { useState } from 'react'
import { AnimatedCounter } from './AnimatedCounter'
import { PlayerRadar, RadarData } from './PlayerRadar'
import { TrendChart, TrendPoint } from './TrendChart'
import { ZoneBars, ZoneRow } from './ZoneBars'
import { Flame, Zap, Gauge, Route, Activity, TrendingUp } from 'lucide-react'

export type Session = {
  id: string
  session_date: string
  session_label: string | null
  total_distance_m: number | null
  max_speed_kmh: number | null
  sprint_count: number | null
  player_load: number | null
  accel_count: number | null
  decel_count: number | null
  hsr_distance_m: number | null
  sprint_distance_m: number | null
  duration_mins: number | null
  zone1_m: number | null
  zone2_m: number | null
  zone3_m: number | null
  zone4_m: number | null
  zone5_m: number | null
}

function short(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export function PlayerDashboard({ sessions, playerName }: { sessions: Session[]; playerName: string }) {
  const [trendMetric, setTrendMetric] = useState<'distance' | 'topSpeed' | 'sprints'>('distance')

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-tranmere-blue">
          <Route size={28} />
        </div>
        <p className="font-semibold text-tranmere-blue">No GPS data yet</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Your coach will upload STATSports data after your next session. It'll appear here automatically.
        </p>
      </div>
    )
  }

  const latest = sessions[0]
  const previous = sessions.slice(1)

  // All-time bests
  const best = {
    distance: Math.max(...sessions.map(s => s.total_distance_m ?? 0)),
    topSpeed: Math.max(...sessions.map(s => s.max_speed_kmh ?? 0)),
    sprints: Math.max(...sessions.map(s => s.sprint_count ?? 0)),
    load: Math.max(...sessions.map(s => s.player_load ?? 0)),
  }

  // PB flags
  const isPB = {
    distance: (latest.total_distance_m ?? 0) === best.distance && previous.some(p => (p.total_distance_m ?? 0) > 0),
    topSpeed: (latest.max_speed_kmh ?? 0) === best.topSpeed && previous.some(p => (p.max_speed_kmh ?? 0) > 0),
    sprints: (latest.sprint_count ?? 0) === best.sprints && previous.some(p => (p.sprint_count ?? 0) > 0),
  }

  // Trend data (oldest → newest)
  const trendData: TrendPoint[] = [...sessions].reverse().slice(-12).map(s => ({
    date: short(s.session_date),
    distance: s.total_distance_m ? +(s.total_distance_m / 1000).toFixed(2) : 0,
    topSpeed: s.max_speed_kmh ?? 0,
    sprints: s.sprint_count ?? 0,
  }))

  // Zone data (last 8 sessions, oldest → newest)
  const zoneData: ZoneRow[] = [...sessions].reverse().slice(-8).map(s => ({
    date: short(s.session_date),
    Walking:   Math.round(s.zone1_m ?? 0),
    Jogging:   Math.round(s.zone2_m ?? 0),
    Running:   Math.round(s.zone3_m ?? 0),
    HSR:       Math.round(s.zone4_m ?? 0),
    Sprinting: Math.round(s.zone5_m ?? 0),
  }))
  const hasZoneData = zoneData.some(r => r.Walking + r.Jogging + r.Running + r.HSR + r.Sprinting > 0)

  // Radar: normalise each metric against the player's all-time best (0-100 scale)
  const radar: RadarData[] = [
    { metric: 'Distance',  value: pct(latest.total_distance_m, best.distance),  raw: fmtKm(latest.total_distance_m) },
    { metric: 'Top Speed', value: pct(latest.max_speed_kmh, best.topSpeed),     raw: `${latest.max_speed_kmh ?? 0} km/h` },
    { metric: 'Sprints',   value: pct(latest.sprint_count, best.sprints),       raw: `${latest.sprint_count ?? 0}` },
    { metric: 'Accel',     value: pct(latest.accel_count, Math.max(...sessions.map(s => s.accel_count ?? 0))), raw: `${latest.accel_count ?? 0}` },
    { metric: 'Decel',     value: pct(latest.decel_count, Math.max(...sessions.map(s => s.decel_count ?? 0))), raw: `${latest.decel_count ?? 0}` },
    { metric: 'Load',      value: pct(latest.player_load, best.load),           raw: `${latest.player_load ?? 0}` },
  ]

  return (
    <div className="space-y-5">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-tranmere-blue via-blue-800 to-indigo-900 p-6 text-white shadow-xl">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="relative space-y-1">
          <p className="text-xs uppercase tracking-widest text-blue-200">Latest Session</p>
          <h2 className="text-2xl font-bold">{latest.session_label ?? 'Session'}</h2>
          <p className="text-sm text-blue-200">
            {new Date(latest.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {latest.duration_mins && ` · ${latest.duration_mins} mins`}
          </p>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroStat
            icon={<Route size={16} />}
            label="Distance"
            value={latest.total_distance_m ? +(latest.total_distance_m / 1000).toFixed(2) : 0}
            suffix=" km"
            decimals={2}
            pb={isPB.distance}
          />
          <HeroStat
            icon={<Gauge size={16} />}
            label="Top Speed"
            value={latest.max_speed_kmh ?? 0}
            suffix=" km/h"
            decimals={1}
            pb={isPB.topSpeed}
          />
          <HeroStat
            icon={<Zap size={16} />}
            label="Sprints"
            value={latest.sprint_count ?? 0}
            pb={isPB.sprints}
          />
          <HeroStat
            icon={<Activity size={16} />}
            label="Player Load"
            value={latest.player_load ?? 0}
            decimals={1}
          />
        </div>
      </div>

      {/* PB CALLOUT */}
      {(isPB.distance || isPB.topSpeed || isPB.sprints) && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4 shadow-sm">
          <div className="rounded-full bg-orange-100 p-2 text-orange-600">
            <Flame size={20} />
          </div>
          <div>
            <p className="font-bold text-orange-700">🔥 New Personal Best{(Number(isPB.distance) + Number(isPB.topSpeed) + Number(isPB.sprints)) > 1 ? 's' : ''}!</p>
            <p className="text-xs text-orange-600">
              {[isPB.distance && 'distance', isPB.topSpeed && 'top speed', isPB.sprints && 'sprints']
                .filter(Boolean).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* RADAR */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Performance Profile</h3>
            <p className="text-xs text-muted-foreground">Latest session vs your all-time best</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-tranmere-blue">
            {playerName}
          </span>
        </div>
        <PlayerRadar data={radar} />
      </div>

      {/* TREND CHART WITH METRIC SWITCHER */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-1.5">
              <TrendingUp size={16} className="text-tranmere-blue" />
              Trends
            </h3>
            <p className="text-xs text-muted-foreground">Last {Math.min(sessions.length, 12)} sessions</p>
          </div>
          <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs">
            {([
              ['distance',  'Distance'],
              ['topSpeed',  'Speed'],
              ['sprints',   'Sprints'],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTrendMetric(k)}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  trendMetric === k ? 'bg-white text-tranmere-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <TrendChart data={trendData} metric={trendMetric} />
      </div>

      {/* ZONE BARS */}
      {hasZoneData && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="font-semibold">Speed Zone Breakdown</h3>
            <p className="text-xs text-muted-foreground">Where you spent your effort per session (metres)</p>
          </div>
          <ZoneBars data={zoneData} />
        </div>
      )}

      {/* ALL-TIME BESTS */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold">All-Time Bests</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <BestStat label="Longest Run" value={(best.distance / 1000).toFixed(2)} suffix=" km" colour="blue" />
          <BestStat label="Fastest" value={best.topSpeed.toFixed(1)} suffix=" km/h" colour="orange" />
          <BestStat label="Most Sprints" value={best.sprints.toString()} colour="green" />
          <BestStat label="Max Load" value={best.load.toFixed(0)} colour="purple" />
        </div>
      </div>
    </div>
  )
}

function HeroStat({ icon, label, value, suffix = '', decimals = 0, pb = false }: {
  icon: React.ReactNode; label: string; value: number; suffix?: string; decimals?: number; pb?: boolean
}) {
  return (
    <div className={`relative rounded-xl p-3 backdrop-blur-sm transition ${pb ? 'bg-orange-500/20 ring-1 ring-orange-300' : 'bg-white/10'}`}>
      {pb && (
        <span className="absolute -top-2 -right-2 rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white shadow-lg">PB</span>
      )}
      <div className="mb-1 flex items-center gap-1.5 text-xs text-blue-200">{icon}{label}</div>
      <p className="text-xl font-bold tabular-nums">
        <AnimatedCounter value={value} decimals={decimals} suffix={suffix} />
      </p>
    </div>
  )
}

function BestStat({ label, value, suffix = '', colour }: { label: string; value: string; suffix?: string; colour: 'blue' | 'orange' | 'green' | 'purple' }) {
  const colours = {
    blue:   'from-blue-50 to-blue-100 text-blue-700',
    orange: 'from-orange-50 to-orange-100 text-orange-700',
    green:  'from-green-50 to-green-100 text-green-700',
    purple: 'from-purple-50 to-purple-100 text-purple-700',
  }[colour]
  return (
    <div className={`rounded-xl bg-gradient-to-br ${colours} p-3`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}{suffix}</p>
    </div>
  )
}

function pct(v: number | null, max: number) {
  if (!v || max === 0) return 0
  return Math.round((v / max) * 100)
}
function fmtKm(m: number | null) {
  return m ? `${(m / 1000).toFixed(2)} km` : '—'
}
