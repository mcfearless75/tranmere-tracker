/**
 * Pure logic for the staff excusal endpoint (app/api/attendance/excuse) —
 * recording that a student is ill or at an appointment. Kept separate from
 * daily_attendance: "did they physically check in" (evidence: GPS, selfie,
 * NFC tap) stays distinct from "why weren't they expected in" (a staff
 * reason, no evidence attached). See
 * docs/superpowers/specs/2026-09-08-attendance-excusals-design.md
 */

import type { AttendancePhase } from '@/lib/attendance/phase'

export type ExcusalReason = 'ill' | 'appointment' | 'other'

export const EXCUSAL_REASONS: readonly ExcusalReason[] = ['ill', 'appointment', 'other'] as const
export const EXCUSAL_PHASES: readonly AttendancePhase[] = ['am', 'lunch', 'pm'] as const

/** Short labels used on both the reason picker and the per-phase pill. */
export const EXCUSAL_LABELS: Record<ExcusalReason, string> = {
  ill: 'Ill',
  appointment: 'Appt',
  other: 'Other',
}

export type ExcuseRequest =
  | { studentId: string; date: string; action: 'excuse'; reason: ExcusalReason; note?: string; phases?: AttendancePhase[] }
  | { studentId: string; date: string; action: 'clear' }
  | { studentId: string; date: string; action: 'clear_phase'; phase: AttendancePhase }

export function isValidExcuseRequest(body: {
  studentId?: unknown
  date?: unknown
  action?: unknown
  reason?: unknown
  note?: unknown
  phases?: unknown
  phase?: unknown
}): body is ExcuseRequest {
  const hasBaseFields =
    typeof body.studentId === 'string' && body.studentId.length > 0 &&
    typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
  if (!hasBaseFields) return false

  if (body.action === 'clear') return true

  if (body.action === 'clear_phase') {
    return EXCUSAL_PHASES.includes(body.phase as AttendancePhase)
  }

  if (body.action !== 'excuse') return false
  if (!EXCUSAL_REASONS.includes(body.reason as ExcusalReason)) return false
  if (body.note !== undefined && typeof body.note !== 'string') return false
  if (body.phases !== undefined) {
    if (!Array.isArray(body.phases) || body.phases.length === 0) return false
    if (!body.phases.every(p => EXCUSAL_PHASES.includes(p))) return false
  }
  return true
}

/** Defaults to the whole day when `phases` is omitted or empty — the common case (a sick day covers AM/Lunch/PM). */
export function resolvePhases(phases: AttendancePhase[] | undefined): AttendancePhase[] {
  return phases && phases.length > 0 ? phases : [...EXCUSAL_PHASES]
}

/** Row to upsert into attendance_excusals for an 'excuse' request. */
export function buildExcusalRow(
  studentId: string,
  date: string,
  reason: ExcusalReason,
  note: string | undefined,
  phases: AttendancePhase[] | undefined,
  createdBy: string,
) {
  return {
    student_id: studentId,
    excused_date: date,
    reason,
    note: note ?? null,
    phases: resolvePhases(phases),
    created_by: createdBy,
  }
}

/** Does an excusal's phases[] cover the given phase? A null/undefined excusal covers nothing. */
export function excusalCoversPhase(
  excusal: { phases: string[] } | null | undefined,
  phase: AttendancePhase,
): boolean {
  return excusal?.phases.includes(phase) ?? false
}

/** Phases list with one phase removed — used by the 'clear_phase' action to narrow coverage. */
export function removePhase(phases: string[], phase: AttendancePhase): string[] {
  return phases.filter(p => p !== phase)
}

/**
 * Drops any phase that already has a real check-in. An excusal covering a
 * phase the student already tapped in for would be a no-op that corrupts the
 * weekly % (the day would count as both checked AND excused, shrinking its
 * denominator below its numerator). Called by the 'excuse' action before
 * writing the row.
 */
export function stripCheckedPhases(
  phases: AttendancePhase[],
  checked: { am: boolean; lunch: boolean; pm: boolean },
): AttendancePhase[] {
  return phases.filter(p => !checked[p])
}
