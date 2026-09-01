// lib/timetable/timetableUtils.ts
// Pure helpers for the 1st-year weekly timetable — dependency-free besides
// londonWallTimeToUTC, so the reminder-window logic is unit-testable without
// touching Supabase or push infrastructure.

import { londonWallTimeToUTC } from '@/lib/dates'

export type TimetableSlotRow = {
  id: string
  year_group: number
  day_of_week: number // 1=Mon, 2=Tue, 4=Thu, 5=Fri (0=Sun..6=Sat convention; 3=Wed never appears — match day)
  start_time: string // 'HH:MM' or 'HH:MM:SS'
  end_time: string
  title: string
  location?: string | null
  tutor?: string | null
}

export const DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  4: 'Thursday',
  5: 'Friday',
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
