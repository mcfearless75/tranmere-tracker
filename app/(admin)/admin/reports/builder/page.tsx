import { createAdminClient } from '@/lib/supabase/admin'
import { ReportBuilderClient } from './ReportBuilderClient'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ReportBuilderPage() {
  const supabase = createAdminClient()

  const [{ data: students }, { data: courses }] = await Promise.all([
    supabase.from('users').select('id, name, role, course_id, courses(name)').order('name'),
    supabase.from('courses').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-5">
      <Link href="/admin/reports" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Reports
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-tranmere-blue">Custom Report Builder</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick metrics, filter by course/role, export to CSV</p>
      </div>
      <ReportBuilderClient students={(students ?? []) as any} courses={courses ?? []} />
    </div>
  )
}
