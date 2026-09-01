import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseworkList } from '@/components/coursework/CourseworkList'
import { groupAssignmentsByUnit, type AssignmentWithGrade } from '@/lib/coursework/courseworkUtils'

export const dynamic = 'force-dynamic'

export default async function CourseworkPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, course_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'student' || !profile.course_id) {
    return (
      <div className="space-y-4">
        <div className="py-2">
          <h1 className="text-lg font-bold text-tranmere-blue">Coursework</h1>
        </div>
        <p className="text-sm text-muted-foreground">No course assigned yet.</p>
      </div>
    )
  }

  const { data: units } = await supabase
    .from('btec_units')
    .select('id, course_id, unit_number, unit_name')
    .eq('course_id', profile.course_id)
    .order('unit_number')

  const unitIds = (units ?? []).map(u => u.id)

  const { data: assignments } = unitIds.length
    ? await supabase
        .from('assignments')
        .select('id, unit_id, title, description, due_date, grade_target')
        .in('unit_id', unitIds)
    : { data: [] }

  const { data: grades } = await supabase
    .from('assignment_grades')
    .select('assignment_id, grade')
    .eq('student_id', user.id)

  const gradeByAssignmentId = new Map((grades ?? []).map(g => [g.assignment_id, g.grade]))

  const assignmentsWithGrade: AssignmentWithGrade[] = (assignments ?? []).map(a => ({
    ...a,
    grade: (gradeByAssignmentId.get(a.id) ?? null) as AssignmentWithGrade['grade'],
  }))

  const groups = groupAssignmentsByUnit(assignmentsWithGrade, units ?? [])

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Coursework</h1>
        <p className="text-xs text-muted-foreground">Your BTEC assignments and results</p>
      </div>
      <CourseworkList groups={groups} />
    </div>
  )
}
