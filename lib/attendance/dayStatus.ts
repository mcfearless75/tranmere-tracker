/**
 * Shared per-student, per-day attendance state — one source of truth for the
 * tri-phase attendance card (student + staff), the staff exceptions home,
 * and the parent "today" timeline, so all three read the same rules instead
 * of each re-deriving "missing" from raw daily_attendance columns.
 */

import { decidePhase, londonMinutes, toMinutes, type AttendancePhase, type PhaseWindow, type PhaseWindows } from '@/lib/attendance/phase'
import { londonWeekday } from '@/lib/dates'

export type Phase = AttendancePhase
export type PhaseState = 'checked' | 'late' | 'excused' | 'missing' | 'not_yet' | 'flagged'

export type PhaseStatus = {
  state: PhaseState
  at: string | null // ISO timestamp, if tapped
  flag: string | null // flag reason (GPS etc.), only set when state === 'flagged'
}

export type StudentDayStatus = {
  studentId: string
  phases: Record<Phase, PhaseStatus>
}

/** The tap evidence for one phase, as read off a daily_attendance row. */
export type PhaseRecord = {
  checkedAt: string | null
  isFlagged: boolean
  flagReason: string | null
}

/**
 * Present-like states that count as "here" for the day — a filled dot, and
 * never "missing". `late` has no live data source yet (submit_daily_check_in
 * rejects taps outside the window rather than admitting a late one), but the
 * state exists for when/if that changes; treated the same as `checked` here.
 */
const PRESENT_STATES: readonly PhaseState[] = ['checked', 'late', 'excused', 'flagged']

/**
 * Determines one phase's state. A real tap always wins over an excusal
 * (matches the existing weekly-report rule: a checked phase never also
 * counts as excused) — `excused` only applies when there is no tap at all.
 */
export function phaseState(
  record: PhaseRecord | undefined,
  window: PhaseWindow,
  now: Date,
  excused: boolean,
): PhaseState {
  if (record?.checkedAt) return record.isFlagged ? 'flagged' : 'checked'
  if (excused) return 'excused'
  return londonMinutes(now) < toMinutes(window.start) ? 'not_yet' : 'missing'
}

/** Builds a full day status for one student from raw evidence rows. */
export function buildStudentDayStatus(
  studentId: string,
  records: Partial<Record<Phase, PhaseRecord>>,
  windows: PhaseWindows,
  now: Date,
  excusedPhases: readonly Phase[],
): StudentDayStatus {
  const phases = (['am', 'lunch', 'pm'] as const).reduce((acc, phase) => {
    const record = records[phase]
    const state = phaseState(record, windows[phase], now, excusedPhases.includes(phase))
    acc[phase] = {
      state,
      at: record?.checkedAt ?? null,
      flag: state === 'flagged' ? (record?.flagReason ?? null) : null,
    }
    return acc
  }, {} as Record<Phase, PhaseStatus>)

  return { studentId, phases }
}

/** Students missing the given phase — excused, not-yet, and already-present states are never "missing". */
export function missingStudents(
  roster: StudentDayStatus[],
  phase: Phase,
): StudentDayStatus[] {
  return roster.filter(s => s.phases[phase].state === 'missing')
}

/** Phases that should render as a filled dot for the given student's day. */
export function dayDots(status: StudentDayStatus): Phase[] {
  return (['am', 'lunch', 'pm'] as const).filter(phase => PRESENT_STATES.includes(status.phases[phase].state))
}

/** Is today a day students are expected to check in at all (Mon–Fri)? Same rule the AM digest cron already relies on (it only runs weekdays). */
export function isExpectedToday(now: Date = new Date()): boolean {
  const weekday = londonWeekday(now)
  return weekday >= 1 && weekday <= 5
}

/**
 * What the tri-phase attendance card should show right now: a check-in CTA
 * for the currently-open-and-missing phase, a "such-and-such opens at HH:MM"
 * for the next one, or a terminal "done" / "closed" / "weekend" state.
 */
export type CardPrompt =
  | { kind: 'weekend' }
  | { kind: 'done' }
  | { kind: 'cta'; phase: Phase }
  | { kind: 'upcoming'; phase: Phase; startsAt: string }
  | { kind: 'closed' }

/**
 * Which phase the staff exceptions home's "missing this window" block should
 * show: the currently open one, or — in a gap between windows, or after the
 * day is over — the window that most recently closed (what staff still need
 * to chase), never an upcoming one nobody's missed yet.
 */
export function exceptionsWindowPhase(windows: PhaseWindows, now: Date = new Date()): Phase | null {
  const open = decidePhase(windows, now)
  if (open) return open
  const mins = londonMinutes(now)
  if (mins < toMinutes(windows.am.start)) return null
  if (mins < toMinutes(windows.lunch.start)) return 'am'
  if (mins < toMinutes(windows.pm.start)) return 'lunch'
  return 'pm'
}

/** Staff attendance-page roster filter. */
export type StaffFilter = 'all' | 'missing_am' | 'missing_lunch' | 'missing_pm' | 'flagged'

/**
 * Which filter the staff attendance page should default to for "right now":
 * once a window's opened, show who's still missing it — the thing staff
 * actually need to act on. Morning defaults to missing_am rather than "all"
 * for the same reason: most of the roster reads not_yet (excluded from
 * missing) before the window closes, so it's never a wall of false alarms.
 */
export function defaultStaffFilter(windows: PhaseWindows, now: Date = new Date()): StaffFilter {
  const mins = londonMinutes(now)
  if (mins >= toMinutes(windows.pm.start)) return 'missing_pm'
  if (mins >= toMinutes(windows.lunch.start)) return 'missing_lunch'
  return 'missing_am'
}

export function applyStaffFilter(roster: StudentDayStatus[], filter: StaffFilter): StudentDayStatus[] {
  switch (filter) {
    case 'all': return roster
    case 'missing_am': return missingStudents(roster, 'am')
    case 'missing_lunch': return missingStudents(roster, 'lunch')
    case 'missing_pm': return missingStudents(roster, 'pm')
    case 'flagged': return roster.filter(s => (['am', 'lunch', 'pm'] as const).some(p => s.phases[p].state === 'flagged'))
  }
}

export function describeCardState(
  status: StudentDayStatus,
  windows: PhaseWindows,
  now: Date = new Date(),
): CardPrompt {
  if (!isExpectedToday(now)) return { kind: 'weekend' }

  const PHASES = ['am', 'lunch', 'pm'] as const
  if (PHASES.every(p => PRESENT_STATES.includes(status.phases[p].state))) return { kind: 'done' }

  const openPhase = decidePhase(windows, now)
  if (openPhase && status.phases[openPhase].state === 'missing') return { kind: 'cta', phase: openPhase }

  const mins = londonMinutes(now)
  const next = PHASES.find(p => mins < toMinutes(windows[p].start))
  if (next) return { kind: 'upcoming', phase: next, startsAt: windows[next].start }

  return { kind: 'closed' }
}
