/**
 * Check-in streaks: consecutive academy days a student scanned themselves
 * in (AM) AND out (PM). Added 2026-09-28 because PM scan-out had collapsed:
 * 19 of 48 students had never scanned out themselves in 15 school days, and
 * staff were bulk-marking the whole cohort present, which removed any reason
 * to scan.
 *
 * Rules:
 *   - Only self-scans count. A staff "Manual override" is not a scan, so it
 *     does not extend a streak, and on an open day it breaks one. GPS-flagged
 *     scans still count because the student physically scanned.
 *   - Only open days can break a streak. A day is open when at least
 *     OPEN_DAY_MIN_SELF_AM students self-scanned in, so weekends, holidays and
 *     INSET days never need configuring.
 *   - Skipped (neither count nor break): today until it is complete, excused
 *     days, and Wednesdays (match day, short timetable). A full Wednesday
 *     still counts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const OPEN_DAY_MIN_SELF_AM = 10
export const STREAK_LOOKBACK_DAYS = 120

export type StreakDay = {
  attendance_date: string
  am_checked_at: string | null
  pm_checked_at: string | null
  am_flag_reason: string | null
  pm_flag_reason: string | null
}

export type Streak = { current: number; best: number; todayDone: boolean }

export function isSelfScan(checkedAt: string | null, flagReason: string | null): boolean {
  return !!checkedAt && !/^manual override/i.test(flagReason ?? '')
}

function isFullDay(d: StreakDay): boolean {
  return isSelfScan(d.am_checked_at, d.am_flag_reason) && isSelfScan(d.pm_checked_at, d.pm_flag_reason)
}

function isWednesday(date: string): boolean {
  return new Date(date + 'T12:00:00Z').getUTCDay() === 3
}

export function openDaysFromCohort(rows: { attendance_date: string; am_flag_reason: string | null }[]): Set<string> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (/^manual override/i.test(r.am_flag_reason ?? '')) continue
    counts.set(r.attendance_date, (counts.get(r.attendance_date) ?? 0) + 1)
  }
  return new Set(Array.from(counts).filter(([, n]) => n >= OPEN_DAY_MIN_SELF_AM).map(([d]) => d))
}

export function computeStreak({ days, openDates, excusedDates, today }: {
  days: StreakDay[]
  openDates: Set<string>
  excusedDates: Set<string>
  today: string
}): Streak {
  const fullDates = new Set(days.filter(isFullDay).map(d => d.attendance_date))
  const candidates = Array.from(new Set([...Array.from(openDates), ...Array.from(fullDates)]))
    .filter(d => d <= today)
    .sort()

  let current = 0
  let best = 0
  for (const date of candidates) {
    if (fullDates.has(date)) {
      current++
      best = Math.max(best, current)
    } else if (date === today || excusedDates.has(date) || isWednesday(date)) {
      continue
    } else {
      current = 0
    }
  }
  return { current, best, todayDone: fullDates.has(today) }
}

/**
 * Loads everything computeStreak needs. Needs the service-role client: the
 * open-day check reads the whole cohort's AM scans, which RLS hides from a
 * student.
 */
export async function getStudentStreak(admin: SupabaseClient, studentId: string, today: string): Promise<Streak> {
  const start = new Date(Date.parse(today + 'T12:00:00Z') - STREAK_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)

  const [own, excusals, cohort] = await Promise.all([
    admin
      .from('daily_attendance')
      .select('attendance_date, am_checked_at, pm_checked_at, am_flag_reason, pm_flag_reason')
      .eq('student_id', studentId)
      .gte('attendance_date', start)
      .lte('attendance_date', today),
    admin
      .from('attendance_excusals')
      .select('excused_date')
      .eq('student_id', studentId)
      .gte('excused_date', start)
      .lte('excused_date', today),
    fetchCohortAmScans(admin, start, today),
  ])
  if (own.error) throw own.error
  if (excusals.error) throw excusals.error

  return computeStreak({
    days: (own.data ?? []) as StreakDay[],
    openDates: openDaysFromCohort(cohort),
    excusedDates: new Set((excusals.data ?? []).map(e => e.excused_date as string)),
    today,
  })
}

// ~30 rows per open day, so the lookback runs past PostgREST's 1000-row cap.
async function fetchCohortAmScans(admin: SupabaseClient, start: string, end: string) {
  const PAGE = 1000
  const rows: { attendance_date: string; am_flag_reason: string | null }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('daily_attendance')
      .select('attendance_date, am_flag_reason')
      .not('am_checked_at', 'is', null)
      .gte('attendance_date', start)
      .lte('attendance_date', end)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}
