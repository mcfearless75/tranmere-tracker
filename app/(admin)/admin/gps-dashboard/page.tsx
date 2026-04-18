import { createClient } from '@/lib/supabase/server'
import { TeamLeaderboard } from '@/components/gps/TeamLeaderboard'
import { SeedDemoButton } from '@/components/gps/SeedDemoButton'
import { Trophy, Users, Route, Zap, Gauge, Activity } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Sess = {
  player_id: string
  total_distance_m: number | null
  max_speed_kmh: number | null
  sprint_count: number | null
  player_load: number | null
  session_date: string
  users: { name: string } | null
}

export default async function GpsDashboardPage() {
  const supabase = createClient()

  // Last 7 days of sessions
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const { data: sessions, error: sessErr } = await supabase
    .from('gps_sessions')
    .select('player_id, total_distance_m, max_speed_kmh, sprint_count, player_load, session_date, users:player_id(name)')
    .gte('session_date', weekAgo)
    .order('session_date', { ascending: false })

  // Migration not run yet
  if (sessErr?.message?.includes('gps_sessions') || sessErr?.message?.includes('does not exist')) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-tranmere-blue">Squad GPS Dashboard</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-semibold text-amber-800">⚠️ Database migration needed</p>
          <p className="text-sm text-amber-700 mt-2">
            Run these migrations in the Supabase SQL Editor (in order):
          </p>
          <ol className="text-sm text-amber-700 mt-2 list-decimal list-inside space-y-1">
            <li><code className="bg-amber-100 px-1.5 py-0.5 rounded">supabase/migrations/003_gps_sessions.sql</code></li>
            <li><code className="bg-amber-100 px-1.5 py-0.5 rounded">supabase/migrations/004_gps_zones.sql</code></li>
          </ol>
          <p className="text-xs text-amber-600 mt-3">
            Open Supabase → SQL Editor → paste each file → Run. Then refresh this page.
          </p>
        </div>
      </div>
    )
  }

  const s = (sessions ?? []) as unknown as Sess[]

  // Aggregate per player
  const byPlayer: Record<string, { name: string; distance: number; topSpeed: number; sprints: number; load: number }> = {}
  for (const row of s) {
    if (!row.users?.name) continue
    const id = row.player_id
    const entry = byPlayer[id] ??= { name: row.users.name, distance: 0, topSpeed: 0, sprints: 0, load: 0 }
    entry.distance += row.total_distance_m ?? 0
    entry.topSpeed = Math.max(entry.topSpeed, row.max_speed_kmh ?? 0)
    entry.sprints += row.sprint_count ?? 0
    entry.load += row.player_load ?? 0
  }

  const entries = Object.values(byPlayer)

  const distance = [...entries].sort((a, b) => b.distance - a.distance).map(e => ({
    name: e.name, value: e.distance, display: (e.distance / 1000).toFixed(2),
  }))
  const topSpeed = [...entries].sort((a, b) => b.topSpeed - a.topSpeed).map(e => ({
    name: e.name, value: e.topSpeed, display: e.topSpeed.toFixed(1),
  }))
  const sprints = [...entries].sort((a, b) => b.sprints - a.sprints).map(e => ({
    name: e.name, value: e.sprints, display: e.sprints.toString(),
  }))
  const load = [...entries].sort((a, b) => b.load - a.load).map(e => ({
    name: e.name, value: e.load, display: e.load.toFixed(0),
  }))

  const totalDistance = entries.reduce((sum, e) => sum + e.distance, 0) / 1000
  const totalSprints = entries.reduce((sum, e) => sum + e.sprints, 0)
  const highestSpeed = Math.max(0, ...entries.map(e => e.topSpeed))
  const avgLoad = entries.length ? entries.reduce((sum, e) => sum + e.load, 0) / entries.length : 0

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tranmere-blue">Squad GPS Dashboard</h1>
          <p className="text-sm text-muted-foreground">Last 7 days · {entries.length} player{entries.length === 1 ? '' : 's'} with data</p>
        </div>
        <SeedDemoButton />
      </div>

      {/* TEAM TOTALS HERO */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TotalCard icon={<Route size={16} />}   label="Team Distance"  value={totalDistance.toFixed(1)} suffix=" km" colour="blue" />
        <TotalCard icon={<Gauge size={16} />}   label="Fastest Player" value={highestSpeed.toFixed(1)}  suffix=" km/h" colour="orange" />
        <TotalCard icon={<Zap size={16} />}     label="Total Sprints"  value={totalSprints.toString()}  colour="green" />
        <TotalCard icon={<Activity size={16} />} label="Avg Player Load" value={avgLoad.toFixed(0)}     colour="purple" />
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center">
          <div className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-tranmere-blue">
            <Trophy size={28} />
          </div>
          <p className="font-semibold">No GPS data in the last 7 days</p>
          <p className="text-sm text-muted-foreground mt-1">
            Import STATSports sessions from <a href="/admin/gps-import" className="text-tranmere-blue underline">GPS Import</a> to populate the leaderboard.
          </p>
        </div>
      ) : (
        <TeamLeaderboard distance={distance} topSpeed={topSpeed} sprints={sprints} load={load} />
      )}
    </div>
  )
}

function TotalCard({ icon, label, value, suffix = '', colour }: {
  icon: React.ReactNode; label: string; value: string; suffix?: string; colour: 'blue' | 'orange' | 'green' | 'purple'
}) {
  const colours = {
    blue:   'from-blue-600 to-blue-800',
    orange: 'from-orange-500 to-red-500',
    green:  'from-green-500 to-emerald-600',
    purple: 'from-purple-500 to-indigo-600',
  }[colour]
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colours} p-4 text-white shadow-lg`}>
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
      <div className="relative">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-white/80">{icon}{label}</div>
        <p className="text-2xl font-bold tabular-nums">{value}<span className="text-base font-medium opacity-80">{suffix}</span></p>
      </div>
    </div>
  )
}
