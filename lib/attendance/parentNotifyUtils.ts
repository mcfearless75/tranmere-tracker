import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushNotificationToUser } from '@/lib/webpush'

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
