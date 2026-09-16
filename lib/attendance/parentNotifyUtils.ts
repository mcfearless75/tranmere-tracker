import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushNotificationToUser } from '@/lib/webpush'
import type { PhaseState } from '@/lib/attendance/dayStatus'

export type CheckInPhase = 'am' | 'lunch' | 'pm'
export type CheckInStatus = 'checked_in' | 'late' | 'absent'

/**
 * Pure helper — builds the notification title and body strings.
 * Exported so tests can exercise formatting without touching I/O.
 */
export function buildNotificationMessage(
  studentName: string,
  phase: CheckInPhase,
  status: CheckInStatus,
  time: string
): { title: string; body: string } {
  const isLate = status === 'late'

  const title = isLate
    ? `⚠️ Late Check-in — ${studentName}`
    : `✅ Check-in — ${studentName}`

  const body =
    phase === 'lunch'
      ? `${studentName} checked in for lunch at ${time}`
      : `${studentName} checked in for ${phase === 'am' ? 'AM' : 'PM'} session at ${time}`

  return { title, body }
}

// ── Parent "today" timeline (dashboard) ─────────────────────────────────────
// One string builder for both the push copy above and the timeline row text
// below, so a parent reading the dashboard sees the same sentence a push
// notification would have used.

const TIMELINE_LABEL: Record<CheckInPhase, string> = { am: 'Morning', lunch: 'Lunch', pm: 'End of day' }
const MISSING_PHASE_TEXT: Record<CheckInPhase, string> = { am: 'the morning', lunch: 'lunch', pm: 'the afternoon' }

/** "{name} has not checked in for lunch yet" — the window is open or has passed, no tap, not excused. */
export function buildMissedCheckinMessage(studentName: string, phase: CheckInPhase): string {
  return `${studentName} has not checked in for ${MISSING_PHASE_TEXT[phase]} yet`
}

/** "End of day not started" — the window hasn't opened yet. */
export function buildNotStartedMessage(phase: CheckInPhase): string {
  return `${TIMELINE_LABEL[phase]} not started`
}

/** "Lunch — excused" */
export function buildExcusedMessage(phase: CheckInPhase): string {
  return `${TIMELINE_LABEL[phase]} — excused`
}

export type ParentTimelineRow = {
  phase: CheckInPhase
  /** London HH:MM, only set for a real tap (checked/late/flagged). */
  time: string | null
  text: string
  /** A tap that's present but outside the geofence — show muted alongside the time, never scare a parent with the raw reason. */
  flagged: boolean
}

function londonTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
}

/** One phase's timeline row. `checkedAt` is the raw ISO timestamp, if any. */
export function buildParentTimelineRow(
  studentName: string,
  phase: CheckInPhase,
  state: PhaseState,
  checkedAt: string | null,
): ParentTimelineRow {
  if (state === 'checked' || state === 'late' || state === 'flagged') {
    const time = londonTime(checkedAt!)
    const { body } = buildNotificationMessage(studentName, phase, state === 'late' ? 'late' : 'checked_in', time)
    return { phase, time, text: body, flagged: state === 'flagged' }
  }
  if (state === 'excused') return { phase, time: null, text: buildExcusedMessage(phase), flagged: false }
  if (state === 'not_yet') return { phase, time: null, text: buildNotStartedMessage(phase), flagged: false }
  return { phase, time: null, text: buildMissedCheckinMessage(studentName, phase), flagged: false }
}

/** Today's three timeline rows for one student, always in AM → lunch → PM order. */
export function buildParentTimeline(
  studentName: string,
  phases: Record<CheckInPhase, { state: PhaseState; at: string | null }>,
): ParentTimelineRow[] {
  return (['am', 'lunch', 'pm'] as const).map(phase =>
    buildParentTimelineRow(studentName, phase, phases[phase].state, phases[phase].at)
  )
}

/**
 * Looks up every parent linked to `studentId` (parent_student_links,
 * 020_parent_portal.sql) plus the student's display name (users.name) and
 * fires a push notification to each parent.
 *
 * Never throws — a push failure must not break the check-in flow — but
 * failures are logged so they are visible in the Vercel function logs rather
 * than silently swallowed.
 */
export async function notifyParentsOfCheckIn(
  adminClient: SupabaseClient,
  studentId: string,
  phase: CheckInPhase,
  status: CheckInStatus
): Promise<void> {
  try {
    const time = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
    })

    // Student display name
    const { data: student } = await adminClient
      .from('users')
      .select('name')
      .eq('id', studentId)
      .maybeSingle()

    const studentName = student?.name ?? 'Student'

    // All linked parents
    const { data: links } = await adminClient
      .from('parent_student_links')
      .select('parent_id')
      .eq('student_id', studentId)

    if (!links?.length) return

    const { title, body } = buildNotificationMessage(studentName, phase, status, time)

    const results = await Promise.allSettled(
      links.map(link =>
        sendPushNotificationToUser(adminClient, link.parent_id, title, body)
      )
    )
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[parentNotify] push to parent failed:', r.reason)
      }
    }
  } catch (err) {
    // Swallow — push failure must never break check-in — but leave a trace.
    console.error('[parentNotify] failed to notify parents of check-in:', err)
  }
}
