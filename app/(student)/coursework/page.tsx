import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AssignmentCard } from '@/components/coursework/AssignmentCard'

export const dynamic = 'force-dynamic'

export default async function CourseworkPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Use admin client to bypass RLS issues for unit/assignment reads
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('course_id, courses(name)')
    .eq('id', user!.id)
    .single()

  const courseName = (profile?.courses as any)?.name ?? ''

  // Get all units for this student's course
  const { data: units } = await admin
    .from('btec_units')
    .select('id, unit_number, unit_name')
    .eq('course_id', profile?.course_id ?? '')
    .order('unit_number')

  // Get all assignments for this course
  const { data: assignments } = await admin
    .from('assignments')
    .select('id, unit_id, title, due_date, grade_target, description')
    .in('unit_id', (units ?? []).map(u => u.id))
    .order('due_date')

  // Get this student's submissions
  const { data: submissions } = await admin
    .from('submissions')
    .select('assignment_id, status, grade, feedback')
    .eq('student_id', user!.id)

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map(s => [s.assignment_id, s])
  )

  const totalAssignments = assignments?.length ?? 0
  const submitted = (submissions ?? []).filter(s => ['submitted', 'graded'].includes(s.status)).length
  const pct = totalAssignments > 0 ? Math.round((submitted / totalAssignments) * 100) : 0

  // Next upcoming assignment
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = (assignments ?? []).filter(a => {
    const sub = submissionMap[a.id]
    return a.due_date >= today && (!sub || ['not_started', 'in_progress'].includes(sub.status))
  }).sort((a, b) => a.due_date.localeCompare(b.due_date))[0]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">BTEC Coursework</h1>
        {courseName && <p className="text-sm text-muted-foreground">{courseName}</p>}
      </div>

      {!profile?.course_id && (
        <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4">
          <p className="text-sm text-amber-800">No course assigned yet. Contact your coach or teacher.</p>
        </div>
      )}

      {totalAssignments > 0 && (
        <>
          {/* Progress hero */}
          <div className="rounded-2xl bg-gradient-to-br from-tranmere-blue to-blue-800 p-5 text-white shadow-lg">
            <p className="text-xs uppercase tracking-widest text-blue-200">Overall Progress</p>
            <p className="text-3xl font-bold mt-1">{pct}%</p>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden mt-3">
              <div className="h-full bg-white transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-blue-200 mt-2">
              {submitted} of {totalAssignments} assignments submitted
            </p>
          </div>

          {/* Next up */}
          {upcoming && (
            <div className="rounded-2xl border bg-white p-4 border-l-4 border-l-amber-400">
              <p className="text-xs uppercase tracking-wide font-semibold text-amber-700">Next Up</p>
              <p className="font-semibold mt-0.5">{upcoming.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Due {new Date(upcoming.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' · '}
                {Math.ceil((new Date(upcoming.due_date).getTime() - Date.now()) / 86400000)} day{Math.ceil((new Date(upcoming.due_date).getTime() - Date.now()) / 86400000) !== 1 ? 's' : ''} away
              </p>
            </div>
          )}
        </>
      )}

      {totalAssignments === 0 && profile?.course_id && (
        <p className="text-sm text-muted-foreground text-center py-8">No assignments have been set yet.</p>
      )}

      {/* Grouped by unit */}
      {(units ?? []).map(u => {
        const unitAssignments = (assignments ?? []).filter(a => a.unit_id === u.id)
        if (unitAssignments.length === 0) return null
        const unitSubmitted = unitAssignments.filter(a => {
          const sub = submissionMap[a.id]
          return sub && ['submitted', 'graded'].includes(sub.status)
        }).length
        const unitPct = Math.round((unitSubmitted / unitAssignments.length) * 100)

        return (
          <div key={u.id} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                <span className="font-mono">{u.unit_number}</span> · {u.unit_name}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-12 h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full ${unitPct === 100 ? 'bg-green-500' : 'bg-tranmere-blue'}`}
                    style={{ width: `${unitPct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{unitSubmitted}/{unitAssignments.length}</span>
              </div>
            </div>
            {unitAssignments.map(a => {
              const sub = submissionMap[a.id]
              return (
                <AssignmentCard
                  key={a.id}
                  assignmentId={a.id}
                  studentId={user!.id}
                  title={a.title}
                  unitName={u.unit_name}
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
      })}
    </div>
  )
}
