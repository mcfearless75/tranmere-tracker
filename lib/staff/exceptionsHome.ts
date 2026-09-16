/** Pure composition helpers for the staff exceptions home (`/admin/home`). */

export type ReviewDue = {
  id: string
  studentId: string
  name: string
  scheduledFor: string | null
  overdue: boolean
}

/**
 * Reviews still needing attention within the next 14 days, overdue ones
 * included — sorted soonest/most-overdue first. Callers should already have
 * filtered the query to `status != 'complete'` and `scheduled_for <=
 * horizonISO`; this shapes the result and flags which ones are overdue.
 */
export function buildReviewsDue(
  reviews: Array<{ id: string; student_id: string; name: string; status: string; scheduled_for: string | null }>,
  todayISO: string,
): ReviewDue[] {
  return reviews
    .filter(r => r.status !== 'complete' && r.scheduled_for !== null)
    .map(r => ({
      id: r.id,
      studentId: r.student_id,
      name: r.name,
      scheduledFor: r.scheduled_for,
      overdue: r.scheduled_for! < todayISO,
    }))
    .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))
}
