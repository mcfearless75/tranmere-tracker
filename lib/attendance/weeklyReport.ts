// Pure calculation logic behind the weekly attendance report
// (app/(admin)/admin/attendance/print/week/page.tsx), split out so the
// Mon-Fri date math and per-student aggregation can be unit tested without
// rendering a Next.js server component or hitting Supabase.

const PHASES = ['am', 'lunch', 'pm'] as const

export type AttendanceRecord = {
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

export type Student = { id: string; name: string }

export type DayCell = { dateISO: string; isFuture: boolean; checkedCount: number }
export type StudentWeekRow = { id: string; name: string; days: DayCell[]; weekPct: number | null }
export type FlagNote = { name: string; dateISO: string; phase: string; reason: string }

export type WeeklyAttendanceSummary = {
  rows: StudentWeekRow[]
  cohortAvgPct: number | null
  belowThreshold: StudentWeekRow[]
  flagNotes: FlagNote[]
}

/** Date-only arithmetic anchored at noon so DST/UTC boundary shifts never roll the calendar date over. */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/** ISO date of the Monday in the same week as `iso` (weeks run Mon-Sun). */
export function mondayOf(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  return shiftDate(iso, diff)
}

/** The five weekday dates (Mon-Fri) for the week containing `anchorISO`. */
export function weekDatesFrom(anchorISO: string): string[] {
  const monday = mondayOf(anchorISO)
  return [0, 1, 2, 3, 4].map(i => shiftDate(monday, i))
}

const BELOW_THRESHOLD_PCT = 80

/**
 * Aggregates raw daily_attendance rows into one attendance-% row per student
 * for the given week. `todayISO` is the London calendar date "now" — days
 * after it are excluded from the % denominator (they haven't happened yet)
 * and rendered as not-yet-due rather than absent.
 */
export function computeWeeklyAttendance(
  students: Student[],
  records: AttendanceRecord[],
  weekDates: string[],
  todayISO: string,
): WeeklyAttendanceSummary {
  const byStudent = new Map<string, Map<string, AttendanceRecord>>()
  for (const r of records) {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, new Map())
    byStudent.get(r.student_id)!.set(r.attendance_date, r)
  }

  const flagNotes: FlagNote[] = []

  const rows: StudentWeekRow[] = students.map(s => {
    const recByDate = byStudent.get(s.id)
    let weeklyChecked = 0
    let weeklyPossible = 0

    const days: DayCell[] = weekDates.map(dateISO => {
      const isFuture = dateISO > todayISO
      const r = recByDate?.get(dateISO)
      const checkedCount = r ? PHASES.filter(p => r[`${p}_checked_at` as const]).length : 0

      if (!isFuture) {
        weeklyChecked += checkedCount
        weeklyPossible += 3
      }
      if (r) {
        for (const p of PHASES) {
          if (r[`${p}_is_flagged` as const]) {
            flagNotes.push({
              name: s.name,
              dateISO,
              phase: p.toUpperCase(),
              reason: r[`${p}_flag_reason` as const] ?? '—',
            })
          }
        }
      }
      return { dateISO, isFuture, checkedCount }
    })

    const weekPct = weeklyPossible > 0 ? Math.round((weeklyChecked / weeklyPossible) * 100) : null
    return { id: s.id, name: s.name, days, weekPct }
  })

  const withData = rows.filter(r => r.weekPct !== null)
  const cohortAvgPct = withData.length > 0
    ? Math.round(withData.reduce((sum, r) => sum + (r.weekPct ?? 0), 0) / withData.length)
    : null
  const belowThreshold = withData.filter(r => (r.weekPct ?? 100) < BELOW_THRESHOLD_PCT)

  return { rows, cohortAvgPct, belowThreshold, flagNotes }
}
