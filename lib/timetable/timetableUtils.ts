// lib/timetable/timetableUtils.ts
// Pure helpers for the 1st-year weekly timetable — dependency-free besides
// londonWallTimeToUTC, so the reminder-window logic is unit-testable without
// touching Supabase or push infrastructure.

import { londonWallTimeToUTC } from '@/lib/dates'

export type TimetableSlotRow = {
  id: string
  year_group: number
  day_of_week: number // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri (0=Sun..6=Sat convention). Wed is
  // match day but can still carry a real slot (e.g. a session before travel/kick-off) —
  // see 054_year1_timetable_2026_27.sql.
  start_time: string // 'HH:MM' or 'HH:MM:SS'
  end_time: string
  title: string
  location?: string | null
  tutor?: string | null
}

export const DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
}

// Mirrors the DB check constraint on timetable_slots.year_group (migration
// 046_timetable.sql) — keep both in sync if a new year group is added.
export const VALID_TIMETABLE_YEAR_GROUPS = [1, 2]

export const YEAR_GROUP_LABELS: Record<number, string> = {
  1: '1st Year',
  2: '2nd Year',
}

/**
 * Returns the slots (already filtered to today's day_of_week by the caller)
 * whose start time falls 13–18 minutes from `now`. The 5-minute-wide window
 * matches the cron's 5-minute tick, so a slot starting "in 15 minutes" is
 * caught exactly once as the window slides forward each invocation.
 */
export function getSlotsDueForReminder(
  slots: TimetableSlotRow[],
  now: Date,
  todayISO: string
): TimetableSlotRow[] {
  return slots.filter(slot => {
    const startsAt = londonWallTimeToUTC(todayISO, slot.start_time)
    const minutesUntil = (startsAt.getTime() - now.getTime()) / 60_000
    return minutesUntil >= 13 && minutesUntil < 18
  })
}

/**
 * timetable_slots are recurring weekly (matched purely by day_of_week), so
 * "the slots for a given calendar date" just means filtering to that date's
 * weekday — computed from the y/m/d components directly (Date.UTC), never
 * from a wall-clock instant, so this can't be thrown off by BST/GMT.
 */
export function getSlotsForDate<T extends { day_of_week: number }>(slots: T[], dateISO: string): T[] {
  const [y, m, d] = dateISO.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return slots.filter(slot => slot.day_of_week === dayOfWeek)
}

/** A timetable_slots row shaped like an attendance_sessions row, so it can
 *  be merged into the same "today's sessions" list the dashboard renders. */
export type TimetableSlotAsSession = {
  id: string
  session_label: string
  session_type: 'class'
  opens_at: string
  closes_at: string
}

export function timetableSlotToSession(
  slot: Pick<TimetableSlotRow, 'id' | 'title' | 'location' | 'start_time' | 'end_time'>,
  dateISO: string,
): TimetableSlotAsSession {
  return {
    id: `timetable-${slot.id}`,
    session_label: slot.location ? `${slot.title} — ${slot.location}` : slot.title,
    session_type: 'class',
    opens_at: londonWallTimeToUTC(dateISO, slot.start_time).toISOString(),
    closes_at: londonWallTimeToUTC(dateISO, slot.end_time).toISOString(),
  }
}
