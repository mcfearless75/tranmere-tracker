import { createAdminClient } from '@/lib/supabase/admin'
import { GradeSubmissionsClient } from './GradeSubmissionsClient'

export const dynamic = 'force-dynamic'

export default async function GradeSubmissionsPage() {
  const supabase = createAdminClient()

  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      id, title, due_date, grade_target,
      btec_units (unit_number, unit_name, courses (name)),
      submissions (
        id, status, grade, feedback, student_id,
        users:student_id (name)
      )
    `)
    .order('due_date', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tranmere-blue">Grade Submissions</h1>
        <p className="text-sm text-muted-foreground mt-1">Review student work and assign grades</p>
      </div>
      <GradeSubmissionsClient assignments={(assignments ?? []) as any} />
    </div>
  )
}
