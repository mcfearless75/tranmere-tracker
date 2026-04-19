import { createAdminClient } from '@/lib/supabase/admin'
import { EngagementReportClient } from './EngagementReportClient'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EngagementReportPage() {
  const supabase = createAdminClient()

  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [
    { data: students },
    { data: nutrition },
    { data: training },
    { data: matches },
    { data: submissions },
    { data: subs },
  ] = await Promise.all([
    supabase.from('users').select('id, name, course_id, avatar_url, courses(name)').eq('role', 'student').order('name'),
    supabase.from('nutrition_logs').select('student_id, logged_date').gte('logged_date', since),
    supabase.from('training_logs').select('student_id, session_date').gte('session_date', since),
    supabase.from('match_logs').select('student_id, match_date').gte('match_date', since),
    supabase.from('submissions').select('student_id, submitted_at, status').gte('submitted_at', since),
    supabase.from('push_subscriptions').select('user_id'),
  ])

  return (
    <div className="space-y-5">
      <Link href="/admin/reports" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Reports
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-tranmere-blue">Engagement</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 30 days · who&apos;s active, who needs a nudge</p>
      </div>
      <EngagementReportClient
        students={(students ?? []) as any}
        nutrition={nutrition ?? []}
        training={training ?? []}
        matches={matches ?? []}
        submissions={submissions ?? []}
        pushSubs={subs ?? []}
      />
    </div>
  )
}
