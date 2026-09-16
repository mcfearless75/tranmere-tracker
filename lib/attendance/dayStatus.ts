/**
 * Shared per-student, per-day attendance state — one source of truth for the
 * tri-phase attendance card (student + staff), the staff exceptions home,
 * and the parent "today" timeline, so all three read the same rules instead
 * of each re-deriving "missing" from raw daily_attendance columns.
 */

import { londonMinutes, toMinutes, type AttendancePhase, type PhaseWindow, type PhaseWindows } from '@/lib/attendance/phase'
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
