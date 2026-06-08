import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { calcGpsSummary, calcAttendanceSummary, getPerformanceRating } from '@/lib/performance/performanceUtils'
import { PerformanceSparkline } from '@/components/performance/PerformanceSparkline'
import { Route, Gauge, Zap, Calendar, Trophy, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const RATING_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Excellent:       { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' },
  Good:            { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200'  },
  Developing:      { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200' },
  'Needs Attention': { bg: 'bg-red-50',  text: 'text-red-800',    border: 'border-red-200'   },
}

export default async function PerformancePage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const studentId = user.id

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const sixtyDaysAgo  = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)

  // GPS sessions — last 30 days
  const { data: gpsSessions } = await supabase
    .from('gps_sessions')
    .select('total_distance_m, max_speed_ms, max_speed_kmh, duration_mins, session_date, session_label')
    .eq('player_id', studentId)
    .gte('session_date', thirtyDaysAgo)
    .order('session_date', { ascending: true })
    .limit(30)

  // Attendance records — last 60 days joined to sessions
  const { data: attendanceRecords } = await supabase
    .from('attendance_records')
    .select('checked_in_at, attendance_sessions!inner(created_at, session_label)')
    .eq('student_id', studentId)
    .gte('checked_in_at', sixtyDaysAgo + 'T00:00:00Z')

  // Total attendance sessions in range (for denominator)
  const { count: totalSessionCount } = await supabase
    .from('attendance_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sixtyDaysAgo + 'T00:00:00Z')

  // Match squad entries joined to match_events
  const { data: squadEntries } = await supabase
    .from('match_squads')
    .select('status, match_events!inner(id, match_date, opponent, status)')
    .eq('player_id', studentId)
    .order('match_events(match_date)', { ascending: false })
    .limit(20)

  const sessions = gpsSessions ?? []
  const records  = attendanceRecords ?? []
  const squads   = squadEntries ?? []

  const gpsSummary        = calcGpsSummary(sessions)
  const attendanceSummary = calcAttendanceSummary(records, totalSessionCount ?? 0)
  const rating            = getPerformanceRating(gpsSummary, attendanceSummary)
  const ratingStyle       = RATING_STYLES[rating]

  // Last 8 sessions for sparkline
  const sparklineData = sessions.slice(-8).map(s => ({
    date: s.session_date as string,
    distanceKm: Math.round(((s.total_distance_m ?? 0) / 1000) * 10) / 10,
  }))

  // Match summary
  type SquadRow = {
    status: string
    match_events: { id: string; match_date: string; opponent: string; status: string }
  }
  const typedSquads = squads as unknown as SquadRow[]
  const appearances = typedSquads.length
  const recentMatches = typedSquads.slice(0, 5).map(s => ({
    date: s.match_events.match_date,
    opponent: s.match_events.opponent,
    result: s.match_events.status === 'completed' ? 'Played' : s.match_events.status,
  }))

  return (
    <div className="space-y-5 pb-24 px-4 pt-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-tranmere-blue">My Performance</h1>

      {/* Rating badge */}
      <div className={`rounded-2xl border p-4 flex items-center gap-3 ${ratingStyle.bg} ${ratingStyle.border}`}>
        <Trophy size={24} className={ratingStyle.text} />
        <div>
          <p className={`text-sm font-medium ${ratingStyle.text}`}>Overall Rating</p>
          <p className={`text-2xl font-bold ${ratingStyle.text}`}>{rating}</p>
        </div>
      </div>

      {/* GPS stat cards */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          GPS (last 30 days)
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Calendar size={14} />} label="Sessions"      value={gpsSummary.sessions.toString()} />
          <StatCard icon={<Route size={14} />}    label="Avg Distance"  value={`${gpsSummary.avgDistanceKm} km`} />
          <StatCard icon={<Gauge size={14} />}    label="Avg Speed"     value={`${gpsSummary.avgSpeedKmh} km/h`} />
          <StatCard icon={<Zap size={14} />}      label="Top Speed"     value={`${gpsSummary.maxSpeedKmh} km/h`} />
        </div>
      </section>

      {/* Distance trend sparkline */}
      {sparklineData.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Distance Trend
          </h2>
          <div className="rounded-2xl border bg-white p-3">
            <PerformanceSparkline data={sparklineData} />
          </div>
        </section>
      )}

      {/* Attendance */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Attendance (last 60 days)
        </h2>
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600" />
              <span className="text-sm font-medium">
                {attendanceSummary.attended} / {attendanceSummary.totalSessions} sessions
              </span>
            </div>
            <span className="text-lg font-bold tabular-nums">{attendanceSummary.pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-tranmere-blue transition-all"
              style={{ width: `${Math.min(attendanceSummary.pct, 100)}%` }}
            />
          </div>
        </div>
      </section>

      {/* Match appearances */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Match Appearances
        </h2>
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <p className="text-2xl font-bold tabular-nums">{appearances}</p>
          {recentMatches.length > 0 && (
            <ul className="divide-y text-sm">
              {recentMatches.map((m, i) => (
                <li key={i} className="py-2 flex justify-between items-center">
                  <span className="font-medium">vs {m.opponent}</span>
                  <span className="text-muted-foreground tabular-nums">{m.date}</span>
                </li>
              ))}
            </ul>
          )}
          {recentMatches.length === 0 && (
            <p className="text-sm text-muted-foreground">No match appearances yet</p>
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}
