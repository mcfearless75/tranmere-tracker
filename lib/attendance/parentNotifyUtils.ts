import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushNotificationToUser } from '@/lib/webpush'

export type CheckInPhase = 'am' | 'pm'
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
  const session = phase === 'am' ? 'AM' : 'PM'
  const isLate = status === 'late'

  const title = isLate
    ? `⚠️ Late Check-in — ${studentName}`
    : `✅ Check-in — ${studentName}`

  const body = `${studentName} checked in for ${session} session at ${time}`

  return { title, body }
}

/**
 * Looks up every parent linked to `studentId` and fires a push notification
 * to each one. Never throws — a push failure must not break the check-in flow.
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
    })

    // Get student display name
    const { data: studentProfile } = await adminClient
      .from('profiles')
      .select('display_name')
      .eq('id', studentId)
      .maybeSingle()

    const studentName = studentProfile?.display_name ?? 'Student'

    // Find all linked parents
    const { data: parents } = await adminClient
      .from('profiles')
      .select('id')
      .eq('linked_student_id', studentId)
      .eq('role', 'parent')

    if (!parents?.length) return

    const { title, body } = buildNotificationMessage(studentName, phase, status, time)

    await Promise.allSettled(
      parents.map(parent =>
        sendPushNotificationToUser(adminClient, parent.id, title, body)
      )
    )
  } catch {
    // Swallow all errors — push failure must never break check-in
  }
}
