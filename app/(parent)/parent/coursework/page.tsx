// app/(parent)/parent/coursework/page.tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CourseworkList } from '@/components/coursework/CourseworkList'
import { groupAssignmentsByUnit, type AssignmentWithGrade } from '@/lib/coursework/courseworkUtils'

export const dynamic = 'force-dynamic'

function noCourseworkYet(message: string) {
  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Coursework</h1>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export default async function ParentCourseworkPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: links } = await admin
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', user.id)
  const studentId = links?.[0]?.student_id as string | undefined

  if (!studentId) {
    return noCourseworkYet('No linked student found.')
  }

  const { data: student } = await admin
    .from('users')
    .select('course_id')
    .eq('id', studentId)
    .maybeSingle()

  if (!student?.course_id) {
    return noCourseworkYet('No course assigned yet.')
  }

  const { data: units } = await admin
    .from('btec_units')
    .select('id, course_id, unit_number, unit_name')
    .eq('course_id', student.course_id)
    .order('unit_number')

  const unitIds = (units ?? []).map(u => u.id)

  const { data: assignments } = unitIds.length
    ? await admin
        .from('assignments')
        .select('id, unit_id, title, description, due_date, grade_target')
        .in('unit_id', unitIds)
    : { data: [] }

  const { data: grades } = await admin
    .from('assignment_grades')
    .select('assignment_id, grade')
    .eq('student_id', studentId)

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
        <p className="text-xs text-muted-foreground">Your child&apos;s BTEC assignments and results</p>
      </div>
      <CourseworkList groups={groups} />
    </div>
  )
}
