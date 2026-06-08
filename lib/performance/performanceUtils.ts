export interface GpsSummary {
  sessions: number
  avgDistanceKm: number
  avgSpeedKmh: number
  maxSpeedKmh: number
}

export interface AttendanceSummary {
  totalSessions: number
  attended: number
  pct: number
}

export interface MatchSummary {
  appearances: number
  recentMatches: Array<{ date: string; opponent: string; result?: string }>
}

export type PerformanceRating = 'Excellent' | 'Good' | 'Developing' | 'Needs Attention'

interface GpsSessionRow {
  total_distance_m?: number | null
  max_speed_ms?: number | null
  max_speed_kmh?: number | null
  duration_mins?: number | null
}

interface AttendanceRow {
  checked_in_at?: string | null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function calcGpsSummary(sessions: GpsSessionRow[]): GpsSummary {
  if (sessions.length === 0) {
    return { sessions: 0, avgDistanceKm: 0, avgSpeedKmh: 0, maxSpeedKmh: 0 }
  }

  const totalDistanceM = sessions.reduce((sum, s) => sum + (s.total_distance_m ?? 0), 0)
  const avgDistanceKm = round1(totalDistanceM / sessions.length / 1000)

  // Prefer stored max_speed_kmh; fall back to max_speed_ms * 3.6
  const maxSpeedKmh = sessions.reduce((max, s) => {
    const kmh = s.max_speed_kmh != null
      ? s.max_speed_kmh
      : (s.max_speed_ms != null ? s.max_speed_ms * 3.6 : 0)
    return Math.max(max, kmh)
  }, 0)

  // Derive avg speed from distance / duration where possible
  const sessionsWithDuration = sessions.filter(
    s => (s.total_distance_m ?? 0) > 0 && (s.duration_mins ?? 0) > 0
  )
  let avgSpeedKmh = 0
  if (sessionsWithDuration.length > 0) {
    const totalKm = sessionsWithDuration.reduce((sum, s) => sum + (s.total_distance_m ?? 0) / 1000, 0)
    const totalHours = sessionsWithDuration.reduce((sum, s) => sum + (s.duration_mins ?? 0) / 60, 0)
    avgSpeedKmh = totalHours > 0 ? totalKm / totalHours : 0
  }

  return {
    sessions: sessions.length,
    avgDistanceKm,
    avgSpeedKmh: round1(avgSpeedKmh),
    maxSpeedKmh: round1(maxSpeedKmh),
  }
}

export function calcAttendanceSummary(
  records: AttendanceRow[],
  totalSessionCount: number
): AttendanceSummary {
  const attended = records.length
  const totalSessions = Math.max(totalSessionCount, attended)
  const pct = totalSessions > 0 ? round1((attended / totalSessions) * 100) : 0
  return { totalSessions, attended, pct }
}

export function getPerformanceRating(
  gpsSummary: GpsSummary,
  attendanceSummary: AttendanceSummary
): PerformanceRating {
  const { pct } = attendanceSummary
  const { avgDistanceKm } = gpsSummary

  if (pct >= 90 && avgDistanceKm >= 5) return 'Excellent'
  if (pct >= 75 && avgDistanceKm >= 3) return 'Good'
  if (pct >= 60) return 'Developing'
  return 'Needs Attention'
}
