import type { SupabaseClient } from '@supabase/supabase-js'
import { londonDateISO } from '@/lib/dates'
import { notifyUsers } from '@/lib/notifications/notifyStaff'
import type { ConcernCategory, ConcernSeverity } from '@/lib/safeguarding/safeguardingUtils'

export type AutoRaiseConcernParams = {
  studentId: string
  category: ConcernCategory
  severity: ConcernSeverity
  description: string
  notifyTitle: string
  notifyBody: string
  notifyUrl: string
}

/**
 * Auto-raises a system safeguarding concern (raised_by: null) and notifies
 * the DSL (admin role — safeguarding cases are admin-only casework, same
 * convention as app/api/cron/attendance-safeguarding-check/route.ts) on
 * success.
 *
 * Race-guarded by the existing partial unique index
 * safeguarding_concerns_one_auto_per_day (supabase/migrations/060) exactly
 * like attendance-safeguarding-check: a 23505 (unique violation) on insert
 * means another concurrent call already raised it for this
 * student/category/day, which is treated as success, not failure.
 *
 * Best-effort — never throws. A bug here must never break the caller
 * (a chat reply, a survey submission, etc).
 */
export async function autoRaiseConcern(
  admin: SupabaseClient,
  params: AutoRaiseConcernParams,
): Promise<{ raised: boolean }> {
  try {
    const today = londonDateISO()

    const { data: already } = await admin
      .from('safeguarding_concerns')
      .select('id')
      .eq('student_id', params.studentId)
      .eq('category', params.category)
      .eq('raised_date', today)
      .is('raised_by', null)
      .limit(1)
      .maybeSingle()
    if (already) return { raised: false }

    const { data: concern, error: insertError } = await admin
      .from('safeguarding_concerns')
      .insert({
        student_id: params.studentId,
        raised_by: null,
        category: params.category,
        raised_date: today,
        severity: params.severity,
        description: params.description,
        status: 'open',
      })
      .select('id')
      .single()

    if (insertError) {
      if (insertError.code !== '23505') {
        console.error('[autoRaiseConcern] insert failed:', insertError)
      }
      return { raised: false }
    }
    if (!concern) return { raised: false }

    const { data: dsl } = await admin.from('users').select('id').eq('role', 'admin')
    const dslIds = (dsl ?? []).map(d => d.id as string)
    if (dslIds.length > 0) {
      await notifyUsers(admin, dslIds, {
        title: params.notifyTitle,
        body: params.notifyBody,
        url: params.notifyUrl,
      })
    }

    return { raised: true }
  } catch (err) {
    console.error('[autoRaiseConcern] unexpected error:', err)
    return { raised: false }
  }
}
