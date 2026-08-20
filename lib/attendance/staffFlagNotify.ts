import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushNotificationToUser } from '@/lib/webpush'
import type { AttendancePhase } from '@/lib/attendance/phase'

const PHASE_NAMES: Record<AttendancePhase, string> = {
  am: 'morning',
  lunch: 'lunch',
  pm: 'end-of-day',
}

/**
 * Alert staff that a check-in was flagged (off-site GPS or no GPS at all).
 * Best effort — errors are logged, never thrown, so a notification failure
 * can never fail the student's check-in.
 */
export async function notifyStaffOfFlaggedCheckIn(
  adminClient: SupabaseClient,
  studentId: string,
  phase: AttendancePhase,
  reason: string,
): Promise<void> {
  try {
    const [{ data: student }, { data: staff }] = await Promise.all([
      adminClient.from('users').select('name').eq('id', studentId).maybeSingle(),
      adminClient.from('users').select('id').in('role', ['admin', 'coach', 'teacher']),
    ])
    if (!staff?.length) return

    const name = student?.name ?? 'A student'
    const results = await Promise.allSettled(
      staff.map(s =>
        sendPushNotificationToUser(
          adminClient,
          s.id,
          '⚠️ Flagged check-in',
          `${name}'s ${PHASE_NAMES[phase]} check-in was flagged: ${reason}`,
          '/admin/attendance',
        )
      )
    )
    for (const r of results) {
      if (r.status === 'rejected') console.error('[staffFlagNotify] push failed:', r.reason)
    }
  } catch (err) {
    console.error('[staffFlagNotify] failed:', err)
  }
}
