/**
 * Pure aggregator behind the staff "check-in health" page
 * (app/(admin)/admin/attendance/health/page.tsx) — rolls up 7/28 London
 * weekdays of daily_attendance into phase-completion, flag-breakdown and
 * repeat-location-denied signals. No Supabase calls in here: the page fetches
 * rows and passes them in, same layering as lib/attendance/weeklyReport.ts.
 */

import { shiftDate } from '@/lib/attendance/weeklyReport'
import { buildStudentDayStatus, type PhaseRecord } from '@/lib/attendance/dayStatus'
import { londonWallTimeToUTC } from '@/lib/dates'
import { londonMinutes, toMinutes, type AttendancePhase, type PhaseWindows } from '@/lib/attendance/phase'

const PHASES: readonly AttendancePhase[] = ['am', 'lunch', 'pm']

export type HealthAttendanceRecord = {
  student_id: string
  attendance_date: string
  am_checked_at: string | null
  lunch_checked_at: string | null
  pm_checked_at: string | null
  am_is_flagged: boolean | null
  lunch_is_flagged: boolean | null
  pm_is_flagged: boolean | null
  am_flag_reason: string | null
  lunch_flag_reason: string | null
  pm_flag_reason: string | null
}

export type HealthStudent = { id: string; name: string }

/** Keyed `${studentId}|${dateISO}` -> phases excused that day, same convention as weeklyReport.ts's excusalsByStudentDate. */
export type ExcusalsByStudentDate = Map<string, AttendancePhase[]>

export type FlagCategory = 'no_gps' | 'permission_denied' | 'coarse_fix' | 'outside_fence' | 'other'

export type FlagBreakdown = Record<FlagCategory, number>

export type PhaseCompletionStat = { tapped: number; expected: number; pct: number | null }

export type RepeatLocationDenied = { studentId: string; name: string; days: number }

export type CheckInHealthStats = {
  windowDays: number
  dateRange: string[] // chronological, oldest first
  phaseCompletion: Record<AttendancePhase, PhaseCompletionStat>
  missingRate: { lunch: PhaseCompletionStat; pm: PhaseCompletionStat }
  flaggedRate: { flaggedCount: number; totalTaps: number; pct: number | null }
  flagBreakdown: FlagBreakdown
  repeatLocationDenied: RepeatLocationDenied[]
}

/**
 * Last `n` Europe/London weekday (Mon-Fri) dates, walking backwards from
 * `todayISO` (inclusive of today when today is itself a weekday) one day at
 * a time via the DST-safe noon-anchored `shiftDate` — same primitive
 * weeklyReport.ts already uses for pure date-string arithmetic. Returned in
 * chronological order (oldest first).
 */
export function lastNLondonWeekdays(n: number, todayISO: string): string[] {
  const out: string[] = []
  let cursor = todayISO
  while (out.length < n) {
    const dow = new Date(cursor + 'T12:00:00').getDay() // 0=Sun..6=Sat
    if (dow !== 0 && dow !== 6) out.push(cursor)
    cursor = shiftDate(cursor, -1)
  }
  return out.reverse()
}

const MANUAL_OVERRIDE_PREFIX = 'Manual override by '

/** A "Manual override by <staff>" flag is staff-caused, not a check-in-health signal — excluded everywhere below. */
export function isManualOverride(reason: string | null | undefined): boolean {
  return !!reason && reason.startsWith(MANUAL_OVERRIDE_PREFIX)
}

/**
 * Classifies a real (non-override) `flag_reason` string into one of the
 * buckets actually produced by the RPC / API routes — see
 * supabase/migrations/066_accuracy_aware_geofence.sql (`v_reason`),
 * app/api/attendance/check-in/route.ts and app/api/attendance/tap-checkin/route.ts.
 * Returns null for an empty/override reason (nothing to classify).
 *
 * Exact/substring matches confirmed against that source, not invented:
 *   - 'No GPS provided'                                              -> no_gps
 *   - 'Location permission denied on device — check-in allowed ...'  -> permission_denied
 *   - '... — coarse fix, in-app tap' (tap-checkin's tolerance bypass) -> coarse_fix
 *   - 'GPS {n}m from academy' / '... (±{n}m accuracy)'               -> outside_fence
 * The coarse-fix string is itself a 'GPS ...from academy...' sentence, so it
 * must be checked before the generic outside_fence match.
 */
export function classifyFlagReason(reason: string | null | undefined): FlagCategory | null {
  if (!reason || isManualOverride(reason)) return null
  if (reason === 'No GPS provided') return 'no_gps'
  if (reason.includes('permission denied')) return 'permission_denied'
  if (reason.includes('coarse fix')) return 'coarse_fix'
  if (reason.startsWith('GPS ') && reason.includes('from academy')) return 'outside_fence'
  return 'other'
}

function emptyBreakdown(): FlagBreakdown {
  return { no_gps: 0, permission_denied: 0, coarse_fix: 0, outside_fence: 0, other: 0 }
}

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null
}

function toPhaseRecord(
  checkedAt: string | null,
  isFlagged: boolean | null,
  flagReason: string | null,
): PhaseRecord {
  return { checkedAt, isFlagged: isFlagged ?? false, flagReason }
}

/**
 * Aggregates raw daily_attendance rows into the check-in health metrics for
 * the last `windowDays` London weekdays. Reuses dayStatus.ts's phase-state
 * rules (buildStudentDayStatus) rather than re-deriving "expected" / "missing"
 * / "excused" — applied per historical day-in-range instead of "today" for a
 * live roster.
 */
export function computeCheckInHealth(
  students: HealthStudent[],
  records: HealthAttendanceRecord[],
  windows: PhaseWindows,
  windowDays: number,
  todayISO: string,
  now: Date,
  excusalsByStudentDate: ExcusalsByStudentDate = new Map(),
): CheckInHealthStats {
  const dateRange = lastNLondonWeekdays(windowDays, todayISO)

  const recordByDateStudent = new Map<string, HealthAttendanceRecord>()
  for (const r of records) recordByDateStudent.set(`${r.attendance_date}|${r.student_id}`, r)

  const completion: Record<AttendancePhase, PhaseCompletionStat> = {
    am: { tapped: 0, expected: 0, pct: null },
    lunch: { tapped: 0, expected: 0, pct: null },
    pm: { tapped: 0, expected: 0, pct: null },
  }
  const flagBreakdown = emptyBreakdown()
  let flaggedCount = 0
  let totalTaps = 0
  const permissionDeniedDaysByStudent = new Map<string, Set<string>>()

  for (const dateISO of dateRange) {
    // A day fully in the past has every window closed; "today" needs the
    // real instant so an open/not-yet-open phase isn't miscounted as missing
    // (same rule the /admin/attendance page applies for a past `?date=`).
    const instant = dateISO === todayISO ? now : londonWallTimeToUTC(dateISO, '23:59')

    for (const student of students) {
      const r = recordByDateStudent.get(`${dateISO}|${student.id}`)
      const excusedPhases = excusalsByStudentDate.get(`${student.id}|${dateISO}`) ?? []

      const status = buildStudentDayStatus(
        student.id,
        {
          am: toPhaseRecord(r?.am_checked_at ?? null, r?.am_is_flagged ?? null, r?.am_flag_reason ?? null),
          lunch: toPhaseRecord(r?.lunch_checked_at ?? null, r?.lunch_is_flagged ?? null, r?.lunch_flag_reason ?? null),
          pm: toPhaseRecord(r?.pm_checked_at ?? null, r?.pm_is_flagged ?? null, r?.pm_flag_reason ?? null),
        },
        windows,
        instant,
        excusedPhases,
      )

      for (const phase of PHASES) {
        const ps = status.phases[phase]

        // dayStatus.ts's 'missing' fires the instant a window OPENS (right
        // for the live CTA/exceptions-home use case: "still time to chase
        // this"). This aggregator needs the brief's stricter rule instead —
        // "expected and not excused and not tapped, AFTER that window's
        // end" — so a student who simply hasn't tapped yet, with time still
        // left before the window closes, isn't already counted as missing.
        // Every past day's `instant` is already end-of-day (closed), so this
        // only ever fires for `dateISO === todayISO` with a window still
        // open right now. Skip the phase entirely for this student/day —
        // same "not yet decided" exclusion weeklyReport.ts applies to a
        // `isFuture` day (excluded from both numerator and denominator,
        // never counted as absent).
        if (dateISO === todayISO && ps.state === 'missing' && londonMinutes(now) < toMinutes(windows[phase].end)) {
          continue
        }

        const tapped = ps.state === 'checked' || ps.state === 'flagged'
        // "expected" excludes excused (never due) and not_yet (window hasn't
        // opened/resolved yet) — matches missingStudents()/isExpectedToday's
        // notion of who could plausibly be counted "missing" right now.
        const expected = ps.state !== 'excused' && ps.state !== 'not_yet'

        if (expected) completion[phase].expected += 1
        if (tapped) {
          completion[phase].tapped += 1
          totalTaps += 1
        }

        if (ps.state === 'flagged' && ps.flag && !isManualOverride(ps.flag)) {
          flaggedCount += 1
          const category = classifyFlagReason(ps.flag) ?? 'other'
          flagBreakdown[category] += 1
          if (category === 'permission_denied') {
            const days = permissionDeniedDaysByStudent.get(student.id) ?? new Set<string>()
            days.add(dateISO)
            permissionDeniedDaysByStudent.set(student.id, days)
          }
        }
      }
    }
  }

  for (const phase of PHASES) {
    completion[phase].pct = pct(completion[phase].tapped, completion[phase].expected)
  }

  const missingRate = {
    lunch: {
      tapped: completion.lunch.expected - completion.lunch.tapped,
      expected: completion.lunch.expected,
      pct: pct(completion.lunch.expected - completion.lunch.tapped, completion.lunch.expected),
    },
    pm: {
      tapped: completion.pm.expected - completion.pm.tapped,
      expected: completion.pm.expected,
      pct: pct(completion.pm.expected - completion.pm.tapped, completion.pm.expected),
    },
  }

  const nameById = new Map(students.map(s => [s.id, s.name]))
  const repeatLocationDenied: RepeatLocationDenied[] = Array.from(permissionDeniedDaysByStudent.entries())
    .filter(([, days]) => days.size >= 2)
    .map(([studentId, days]) => ({ studentId, name: nameById.get(studentId) ?? 'Unknown', days: days.size }))
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name))

  return {
    windowDays,
    dateRange,
    phaseCompletion: completion,
    missingRate,
    flaggedRate: { flaggedCount, totalTaps, pct: pct(flaggedCount, totalTaps) },
    flagBreakdown,
    repeatLocationDenied,
  }
}

/**
 * Final-review Finding 2: the health page used to gate its empty-state on
 * `stats.flaggedRate.totalTaps === 0`, which conflates "nothing was
 * expected this window" (genuinely empty — holiday week, empty roster) with
 * "something was expected but NOTHING was tapped" (a total check-in
 * outage — exactly the incident this page exists to surface). The latter
 * must render the real, alarming 0%/100% figures instead of an empty-state
 * message that hides them. Emptiness is decided on EXPECTED phase-slots,
 * never on taps.
 */
export function isCheckInHealthEmpty(studentCount: number, stats: CheckInHealthStats): boolean {
  const totalExpected = stats.phaseCompletion.am.expected + stats.phaseCompletion.lunch.expected + stats.phaseCompletion.pm.expected
  return studentCount === 0 || totalExpected === 0
}
