import { getRedFlags, type SurveyResponse } from '@/lib/wellbeing/wellbeingUtils'

// ---------- Raw input row shapes (mirror the Supabase selects) ----------

export type CohortStudent = {
  id: string
  name: string | null
  year_group: number | null
}

export type AttendanceRow = {
  student_id: string
  attendance_date: string
  am_checked_at: string | null
  pm_checked_at: string | null
}

export type GpsRow = {
  player_id: string
  total_distance_m: number | null
  max_speed_kmh: number | null
  sprint_count: number | null
  session_date: string
}

export type MatchRow = {
  student_id: string
  goals: number | null
  assists: number | null
  coach_rating: number | null
  self_rating: number | null
  match_date: string
}

/** A student's latest completed survey responses, keyed for red-flag detection. */
export type WellbeingByStudent = Record<string, SurveyResponse[]>

// ---------- Aggregated output shapes ----------

export type AtRiskStudent = {
  id: string
  name: string
  reason: string
}

export type CohortStats = {
  studentCount: number
  scheduledDays: number
  // Attendance
  attendancePct: number | null
  presentDayCount: number
  // GPS
  gpsSessionCount: number
  totalGpsDistanceKm: number | null
  avgGpsDistanceKm: number | null
  topSpeedKmh: number | null
  // Match
  matchCount: number
  totalGoals: number
  totalAssists: number
  avgCoachRating: number | null
  // Wellbeing
  wellbeingRedFlagCount: number
}

const AT_RISK_ATTENDANCE_THRESHOLD = 80
const PCT = 100

function round(value: number, dp = 1): number {
  const factor = 10 ** dp
  return Math.round(value * factor) / factor
}

/**
 * Aggregates raw cohort rows into headline stats plus the at-risk list.
 * Pure: no DB or network. A metric is null when its source data is empty so
 * downstream prompts can skip it rather than report a misleading zero.
 */
export function aggregateCohort(input: {
  students: CohortStudent[]
  attendance: AttendanceRow[]
  scheduledDays: number
  gps: GpsRow[]
  matches: MatchRow[]
  wellbeing: WellbeingByStudent
}): { stats: CohortStats; atRisk: AtRiskStudent[] } {
  const { students, attendance, scheduledDays, gps, matches, wellbeing } = input

  // ----- Attendance -----
  // A present day = a daily_attendance row where am OR pm check-in exists.
  const presentDayCount = attendance.filter(
    r => r.am_checked_at !== null || r.pm_checked_at !== null
  ).length

  // Expected slots = scheduled days across all students in the cohort.
  const expectedDays = scheduledDays * students.length
  const attendancePct =
    expectedDays > 0 ? round((presentDayCount / expectedDays) * PCT) : null

  // Per-student present-day counts for at-risk attendance detection.
  const presentByStudent = new Map<string, number>()
  for (const r of attendance) {
    if (r.am_checked_at !== null || r.pm_checked_at !== null) {
      presentByStudent.set(r.student_id, (presentByStudent.get(r.student_id) ?? 0) + 1)
    }
  }

  // ----- GPS -----
  const gpsSessionCount = gps.length
  const distances = gps.map(g => g.total_distance_m ?? 0)
  const totalDistanceM = distances.reduce((a, b) => a + b, 0)
  const totalGpsDistanceKm = gpsSessionCount > 0 ? round(totalDistanceM / 1000, 1) : null
  const avgGpsDistanceKm =
    gpsSessionCount > 0 ? round(totalDistanceM / 1000 / gpsSessionCount, 2) : null
  const speeds = gps.map(g => g.max_speed_kmh ?? 0).filter(s => s > 0)
  const topSpeedKmh = speeds.length > 0 ? round(Math.max(...speeds), 1) : null

  // ----- Match -----
  const matchCount = matches.length
  const totalGoals = matches.reduce((a, m) => a + (m.goals ?? 0), 0)
  const totalAssists = matches.reduce((a, m) => a + (m.assists ?? 0), 0)
  const ratedMatches = matches.filter(m => typeof m.coach_rating === 'number')
  const avgCoachRating =
    ratedMatches.length > 0
      ? round(
          ratedMatches.reduce((a, m) => a + (m.coach_rating ?? 0), 0) / ratedMatches.length,
          1
        )
      : null

  // ----- Wellbeing -----
  const redFlagStudentIds = new Set<string>()
  for (const [studentId, responses] of Object.entries(wellbeing)) {
    if (getRedFlags(responses).length > 0) redFlagStudentIds.add(studentId)
  }
  const wellbeingRedFlagCount = redFlagStudentIds.size

  // ----- At-risk list -----
  // A student is at risk if attendance < 80% OR they have a wellbeing red flag.
  const atRisk: AtRiskStudent[] = []
  for (const s of students) {
    const reasons: string[] = []

    if (scheduledDays > 0) {
      const present = presentByStudent.get(s.id) ?? 0
      const pct = round((present / scheduledDays) * PCT)
      if (pct < AT_RISK_ATTENDANCE_THRESHOLD) {
        reasons.push(`attendance ${pct}% (below ${AT_RISK_ATTENDANCE_THRESHOLD}%)`)
      }
    }

    if (redFlagStudentIds.has(s.id)) {
      reasons.push('wellbeing red flag')
    }

    if (reasons.length > 0) {
      atRisk.push({ id: s.id, name: s.name ?? 'Unknown', reason: reasons.join('; ') })
    }
  }

  const stats: CohortStats = {
    studentCount: students.length,
    scheduledDays,
    attendancePct,
    presentDayCount,
    gpsSessionCount,
    totalGpsDistanceKm,
    avgGpsDistanceKm,
    topSpeedKmh,
    matchCount,
    totalGoals,
    totalAssists,
    avgCoachRating,
    wellbeingRedFlagCount,
  }

  return { stats, atRisk }
}

export const COHORT_REPORT_SECTIONS = [
  'Overview',
  'Attendance & Punctuality',
  'Physical (GPS)',
  'Wellbeing',
  'Match Form',
  'Students Needing Attention',
  'Recommended Actions',
] as const

/**
 * Builds the Claude prompt for the cohort executive summary.
 * Asks for British English, direct tone, ≤450 words, and instructs the model
 * to skip a metric entirely when it is missing rather than writing "no data".
 */
export function buildCohortReportPrompt(
  cohortLabel: string,
  stats: CohortStats,
  atRisk: AtRiskStudent[]
): string {
  const lines: string[] = []

  lines.push(`Cohort: ${cohortLabel}`)
  lines.push(`Students in cohort: ${stats.studentCount}`)
  lines.push(`Reporting window: last 30 days`)
  lines.push('')
  lines.push('Aggregated metrics (omit any field you do not see below):')

  if (stats.attendancePct !== null) {
    lines.push(
      `- Attendance: ${stats.attendancePct}% (${stats.presentDayCount} present days across ${stats.scheduledDays} scheduled days)`
    )
  }
  if (stats.gpsSessionCount > 0) {
    lines.push(`- GPS sessions: ${stats.gpsSessionCount}`)
    if (stats.totalGpsDistanceKm !== null) lines.push(`- Total GPS distance: ${stats.totalGpsDistanceKm} km`)
    if (stats.avgGpsDistanceKm !== null) lines.push(`- Average distance per session: ${stats.avgGpsDistanceKm} km`)
    if (stats.topSpeedKmh !== null) lines.push(`- Cohort top speed: ${stats.topSpeedKmh} km/h`)
  }
  if (stats.matchCount > 0) {
    lines.push(`- Matches logged: ${stats.matchCount}`)
    lines.push(`- Goals: ${stats.totalGoals}, Assists: ${stats.totalAssists}`)
    if (stats.avgCoachRating !== null) lines.push(`- Average coach rating: ${stats.avgCoachRating}/10`)
  }
  lines.push(`- Wellbeing red flags: ${stats.wellbeingRedFlagCount} student(s)`)

  lines.push('')
  if (atRisk.length > 0) {
    lines.push('Students needing attention:')
    for (const s of atRisk) {
      lines.push(`- ${s.name}: ${s.reason}`)
    }
  } else {
    lines.push('Students needing attention: none flagged.')
  }

  lines.push('')
  lines.push('Write a concise executive summary for academy leadership.')
  lines.push('Use British English, a direct no-fluff tone, and 450 words or fewer.')
  lines.push('Output structured markdown with EXACTLY these section headings, in this order:')
  for (const section of COHORT_REPORT_SECTIONS) {
    lines.push(`## ${section}`)
  }
  lines.push('')
  lines.push(
    'If a metric is missing above, skip it silently — do not write "no data" or invent figures. ' +
      'Highlight what is going well, name the students needing attention with their reason, ' +
      'and finish with concrete recommended actions.'
  )

  return lines.join('\n')
}
