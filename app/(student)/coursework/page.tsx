import { createClient } from '@/lib/supabase/server'
import { AssignmentCard } from '@/components/coursework/AssignmentCard'

export default async function CourseworkPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('course_id')
    .eq('id', user!.id)
    .single()

  // Get assignments joined through btec_units to filter by course
  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      id, title, due_date, grade_target,
      btec_units!inner(id, unit_name, course_id)
    `)
    .eq('btec_units.course_id', profile?.course_id ?? '')
    .order('due_date')

  // Get this student's existing submissions
  const { data: submissions } = await supabase
    .from('submissions')
    .select('assignment_id, status, grade, feedback')
    .eq('student_id', user!.id)

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map(s => [s.assignment_id, s])
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">BTEC Coursework</h1>

      {!profile?.course_id && (
        <p className="text-sm text-muted-foreground">No course assigned yet. Contact your coach.</p>
      )}

      {assignments?.length === 0 && profile?.course_id && (
        <p className="text-sm text-muted-foreground">No assignments have been set yet.</p>
      )}

      {assignments?.map(a => {
        const unit = a.btec_units as any
        const sub = submissionMap[a.id]
        return (
          <AssignmentCard
            key={a.id}
            assignmentId={a.id}
            studentId={user!.id}
            title={a.title}
            unitName={unit?.unit_name ?? ''}
            dueDate={a.due_date}
            gradeTarget={a.grade_target}
            status={sub?.status ?? 'not_started'}
            grade={sub?.grade ?? null}
            feedback={sub?.feedback ?? null}
          />
        )
      })}
    </div>
  )
}
