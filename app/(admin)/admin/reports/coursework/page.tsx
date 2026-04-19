import { createAdminClient } from '@/lib/supabase/admin'
import { CourseworkReportClient } from './CourseworkReportClient'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CourseworkReportPage() {
  const supabase = createAdminClient()

  const [
    { data: assignments },
    { data: submissions },
    { data: units },
    { data: students },
  ] = await Promise.all([
    supabase.from('assignments').select('id, unit_id, title, due_date, grade_target, btec_units(unit_number, unit_name, course_id, courses(name))'),
    supabase.from('submissions').select('id, assignment_id, student_id, status, grade, users:student_id(name)'),
    supabase.from('btec_units').select('id, unit_number, unit_name, course_id, courses(name)'),
    supabase.from('users').select('id, name, course_id').eq('role', 'student'),
  ])

  return (
    <div className="space-y-5">
      <Link href="/admin/reports" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Reports
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-tranmere-blue">Coursework Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Submission rates, grade distribution, overdue list</p>
      </div>
      <CourseworkReportClient
        assignments={(assignments ?? []) as any}
        submissions={(submissions ?? []) as any}
        units={(units ?? []) as any}
        students={students ?? []}
      />
    </div>
  )
}
