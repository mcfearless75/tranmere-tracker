import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type SubmissionStatus = 'draft' | 'submitted' | 'graded'

interface AssignmentRow {
  id: string
  title: string
  due_date: string
  submission: {
    status: SubmissionStatus | null
    grade: string | null
    feedback: string | null
  } | null
}

function StatusBadge({ status }: { status: SubmissionStatus | null; overdue: boolean }) {
  if (status === 'graded') return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium">Graded</span>
  if (status === 'submitted') return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium">Submitted</span>
  if (status === 'draft') return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 font-medium">Draft</span>
  return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 font-medium">Not submitted</span>
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

  const studentIds = (links ?? []).map(l => l.student_id as string)

  if (studentIds.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No students linked to your account.</p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const ago30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const studentsCoursework = await Promise.all(studentIds.map(async (sid) => {
    const [{ data: profile }, { data: assignments }, { data: submissions }] = await Promise.all([
      admin.from('users').select('name').eq('id', sid).single(),
      admin.from('assignments').select('id, title, due_date').gte('due_date', ago30).order('due_date'),
      admin.from('submissions').select('assignment_id, status, grade, feedback').eq('student_id', sid),
    ])

    const submissionMap = new Map<string, { status: SubmissionStatus; grade: string | null; feedback: string | null }>()
    for (const sub of submissions ?? []) {
      submissionMap.set(sub.assignment_id as string, {
        status: sub.status as SubmissionStatus,
        grade: sub.grade as string | null,
        feedback: sub.feedback as string | null,
      })
    }

    const rows: AssignmentRow[] = (assignments ?? []).map(a => ({
      id: a.id as string,
      title: a.title as string,
      due_date: a.due_date as string,
      submission: submissionMap.get(a.id as string) ?? null,
    }))

    return { sid, name: (profile as { name: string } | null)?.name ?? 'Student', rows }
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-tranmere-blue">Coursework</h1>

      {studentsCoursework.map(({ sid, name, rows }) => (
        <div key={sid} className="bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <p className="font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{rows.length} assignment{rows.length !== 1 ? 's' : ''}</p>
          </div>

          {rows.length > 0 ? (
            <ul className="divide-y">
              {rows.map(row => {
                const dueDate = new Date(row.due_date)
                const isOverdue = row.due_date < today && !row.submission
                const daysLeft = Math.ceil((dueDate.getTime() - new Date(today).getTime()) / 86400000)
                const dueLabelColour = isOverdue ? 'text-red-600' :
                  daysLeft <= 2 ? 'text-amber-600' :
                  row.submission?.status === 'graded' || row.submission?.status === 'submitted' ? 'text-gray-400' :
                  'text-gray-500'

                return (
                  <li key={row.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-gray-800 flex-1">{row.title}</p>
                      <StatusBadge status={row.submission?.status ?? null} overdue={isOverdue} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={dueLabelColour}>
                        {isOverdue ? 'Overdue' :
                          daysLeft === 0 ? 'Due today' :
                          daysLeft === 1 ? 'Due tomorrow' :
                          daysLeft > 0 ? `Due in ${daysLeft} days` :
                          `Due ${dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                        {' '}&mdash; {dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {row.submission?.grade && (
                        <span className="font-semibold text-tranmere-blue">Grade: {row.submission.grade}</span>
                      )}
                    </div>
                    {row.submission?.feedback && (
                      <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">{row.submission.feedback}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="p-4 text-sm text-gray-400">No assignments found.</p>
          )}
        </div>
      ))}
    </div>
  )
}
