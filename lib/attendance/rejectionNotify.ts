import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushNotificationToUser } from '@/lib/webpush'
import type { AttendancePhase } from '@/lib/attendance/phase'

const PHASE_NAMES: Record<AttendancePhase, string> = {
  am: 'morning',
  lunch: 'lunch',
  pm: 'end-of-day',
}

/**
 * Records a rejected (out-of-geofence) in-app check-in attempt and alerts
 * staff the FIRST time it happens for this student/phase/day — so "tried to
 * check in for PM but isn't at the academy" surfaces immediately instead of
 * only showing up as a blank cell on the next manual day-view reload.
 *
 * Repeat attempts while still out of range (a student mashing the button
 * waiting for GPS) update attempt_count/last_rejected_at without re-alerting.
 * Best effort throughout — a failure here can never affect the 422 response
 * already sent to the student.
 */
export async function recordAndNotifyRejection(
  adminClient: SupabaseClient,
  studentId: string,
  attendanceDate: string,
  phase: AttendancePhase,
  distanceM: number | null,
): Promise<void> {
  try {
    const { data: existing } = await adminClient
      .from('attendance_checkin_rejections')
      .select('id, attempt_count')
      .eq('student_id', studentId)
      .eq('attendance_date', attendanceDate)
      .eq('phase', phase)
      .maybeSingle()

    if (existing) {
      await adminClient
        .from('attendance_checkin_rejections')
        .update({
          last_rejected_at: new Date().toISOString(),
          attempt_count: existing.attempt_count + 1,
          distance_m: distanceM,
        })
        .eq('id', existing.id)
      return
    }

    await adminClient.from('attendance_checkin_rejections').insert({
      student_id: studentId,
      attendance_date: attendanceDate,
      phase,
      distance_m: distanceM,
    })

    const [{ data: student }, { data: staff }] = await Promise.all([
      adminClient.from('users').select('name').eq('id', studentId).maybeSingle(),
      adminClient.from('users').select('id').in('role', ['admin', 'coach', 'teacher']),
    ])
    if (!staff?.length) return

    const name = student?.name ?? 'A student'
    const distanceCopy = distanceM != null ? `${Math.round(distanceM)}m from the academy` : 'with no GPS'
    const body = `${name} tried to check in for ${PHASE_NAMES[phase]} but isn't at the academy (${distanceCopy}).`

    const results = await Promise.allSettled(
      staff.map(s =>
        sendPushNotificationToUser(adminClient, s.id, '📍 Off-site check-in attempt', body, '/admin/attendance')
      )
    )
    for (const r of results) {
      if (r.status === 'rejected') console.error('[rejectionNotify] push failed:', r.reason)
    }

    await adminClient
      .from('attendance_checkin_rejections')
      .update({ staff_notified_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('attendance_date', attendanceDate)
      .eq('phase', phase)
  } catch (err) {
    console.error('[rejectionNotify] failed:', err)
  }
}
