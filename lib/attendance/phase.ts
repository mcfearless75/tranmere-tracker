/**
 * Pure attendance-phase logic shared by the student attendance page (server),
 * the planner UI, and the background geofence watcher.
 *
 * All wall-clock decisions are made in Europe/London regardless of the device
 * or server timezone — a phone abroad (or a Vercel UTC server) must agree with
 * the academy clock.
 */

export type AttendancePhase = 'am' | 'lunch' | 'pm'

export type PhaseWindow = { start: string; end: string } // 'HH:MM' or 'HH:MM:SS'

export type PhaseWindows = {
  am: PhaseWindow
  lunch: PhaseWindow
  pm: PhaseWindow
}

/** UI labels for each phase. */
export const PHASE_LABELS: Record<AttendancePhase, string> = {
  am: 'Morning check-in',
  lunch: 'Lunch check-in',
  pm: 'End of day check-out',
}

/** 'HH:MM' or 'HH:MM:SS' → minutes since midnight. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Minutes since midnight in Europe/London for the given instant.
 * Uses Intl.formatToParts — reliable on Vercel (avoids Invalid Date from
 * toLocaleString parsing) and on devices set to other timezones.
 */
export function londonMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
  return h * 60 + m
}

/** Is the London wall-clock currently inside the window (inclusive)? */
export function inWindow(window: PhaseWindow, now: Date = new Date()): boolean {
  const mins = londonMinutes(now)
  return mins >= toMinutes(window.start) && mins <= toMinutes(window.end)
}

/**
 * Which phase is open right now (Europe/London), or null in the gaps
 * between windows / out of hours.
 */
export function decidePhase(
  windows: PhaseWindows,
  now: Date = new Date(),
): AttendancePhase | null {
  const mins = londonMinutes(now)
  const inside = (w: PhaseWindow) => mins >= toMinutes(w.start) && mins <= toMinutes(w.end)
  if (inside(windows.am)) return 'am'
  if (inside(windows.lunch)) return 'lunch'
  if (inside(windows.pm)) return 'pm'
  return null
}

/**
 * Offline fallback used by the background geofence watcher when it has no
 * access to academy_settings: partition the working day into am / lunch / pm.
 * am before 11:00, lunch 11:00–14:30, pm after 14:30 — bounded to 07:00–18:00
 * so the watcher never fires overnight. True settings-driven windows would
 * need a fetch of academy_settings; the server enforces the real windows and
 * idempotency either way.
 */
export function fallbackPartitionPhase(minsSinceMidnight: number): AttendancePhase | null {
  if (minsSinceMidnight < 7 * 60 || minsSinceMidnight > 18 * 60) return null
  if (minsSinceMidnight < 11 * 60) return 'am'
  if (minsSinceMidnight <= 14 * 60 + 30) return 'lunch'
  return 'pm'
}
