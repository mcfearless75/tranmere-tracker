/**
 * Pure logic for the staff manual-override endpoint
 * (app/api/attendance/manual-override). Kept separate so it is unit-testable
 * without a Supabase client.
 */

import type { AttendancePhase } from '@/lib/attendance/phase'

export type OverrideAction = 'mark_present' | 'clear'

export const OVERRIDE_PHASES: readonly AttendancePhase[] = ['am', 'lunch', 'pm'] as const
export const OVERRIDE_ACTIONS: readonly OverrideAction[] = ['mark_present', 'clear'] as const

export function isValidOverrideRequest(body: {
  studentId?: unknown
  date?: unknown
  phase?: unknown
  action?: unknown
}): body is { studentId: string; date: string; phase: AttendancePhase; action: OverrideAction } {
  return (
    typeof body.studentId === 'string' && body.studentId.length > 0 &&
    typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) &&
    OVERRIDE_PHASES.includes(body.phase as AttendancePhase) &&
    OVERRIDE_ACTIONS.includes(body.action as OverrideAction)
  )
}

/**
 * Column patch for daily_attendance. Manual marks are ALWAYS flagged with a
 * "Manual override by <staff>" reason so they stay visibly distinct from real
 * NFC taps in every report. Clearing resets the phase entirely.
 */
export function buildOverridePatch(
  phase: AttendancePhase,
  action: OverrideAction,
  staffName: string,
  now: Date = new Date(),
): Record<string, string | boolean | null> {
  if (action === 'mark_present') {
    return {
      [`${phase}_checked_at`]: now.toISOString(),
      [`${phase}_is_flagged`]: true,
      [`${phase}_flag_reason`]: `Manual override by ${staffName}`,
    }
  }
  return {
    [`${phase}_checked_at`]: null,
    [`${phase}_is_flagged`]: false,
    [`${phase}_flag_reason`]: null,
  }
}
