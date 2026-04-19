import { createAdminClient } from '@/lib/supabase/admin'
import { ProgressReportClient } from './ProgressReportClient'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ProgressReportPage() {
  const supabase = createAdminClient()

  const [
    { data: students },
    { data: courses },
    { data: units },
    { data: assignments },
    { data: submissions },
  ] = await Promise.all([
    supabase.from('users').select('id, name, course_id, avatar_url, courses(name)').eq('role', 'student').order('name'),
    supabase.from('courses').select('id, name').order('name'),
    supabase.from('btec_units').select('id, unit_number, unit_name, course_id').order('unit_number'),
    supabase.from('assignments').select('id, unit_id, title, due_date'),
    supabase.from('submissions').select('student_id, assignment_id, status, grade'),
  ])

  return (
    <div className="space-y-5">
      <Link href="/admin/reports" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Reports
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-tranmere-blue">Student Progress</h1>
        <p className="text-sm text-muted-foreground mt-1">Grade heatmap and at-risk flags across all BTEC units</p>
      </div>
      <ProgressReportClient
        students={(students ?? []) as any}
        courses={courses ?? []}
        units={units ?? []}
        assignments={assignments ?? []}
        submissions={submissions ?? []}
      />
    </div>
  )
}
