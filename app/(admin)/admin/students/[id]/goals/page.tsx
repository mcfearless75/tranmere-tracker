import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowLeft, Flag, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  sortGoals,
  getCompletionRate,
  isOverdue,
  daysUntilDeadline,
  StudentGoal,
} from '@/lib/goals/goalsUtils'

export const dynamic = 'force-dynamic'

const CATEGORY_COLOURS: Record<string, string> = {
  personal:  'bg-purple-100 text-purple-700',
  academic:  'bg-blue-100 text-blue-700',
  football:  'bg-green-100 text-green-700',
  fitness:   'bg-orange-100 text-orange-700',
}

const PRIORITY_DOTS: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-gray-300',
}

export default async function AdminStudentGoalsPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const studentId = params.id

  const { data: student } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', studentId)
    .maybeSingle()

  if (!student) {
    return (
      <div className="text-center py-16 space-y-2">
        <p className="font-semibold text-gray-700">Student not found.</p>
        <Link href="/admin/users" className="text-tranmere-blue underline text-sm">
          Back to Users
        </Link>
      </div>
    )
  }

  const { data } = await supabase
    .from('student_goals')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  const allGoals = (data ?? []) as StudentGoal[]
  const sorted = sortGoals(allGoals)
  const completionRate = getCompletionRate(allGoals)

  const activeGoals = sorted.filter(g => g.status === 'in_progress')
  const doneGoals = sorted.filter(g => g.status !== 'in_progress')

  return (
    <div className="space-y-5">
      <Link
        href={`/admin/students/${studentId}`}
        className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline"
      >
        <ArrowLeft size={14} /> Back to {student.name}
      </Link>

      <div className="flex items-center gap-2">
        <Flag size={20} className="text-tranmere-blue" />
        <div>
          <h1 className="text-xl font-bold text-tranmere-blue">
            Goals — {student.name}
          </h1>
          <p className="text-xs text-muted-foreground">Read-only view of student goals</p>
        </div>
      </div>

      {/* Completion rate */}
      {allGoals.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Overall progress</span>
            <span className="text-sm font-bold text-tranmere-blue">{completionRate}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-tranmere-blue rounded-full"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {allGoals.filter(g => g.status === 'completed').length} of {allGoals.length} goals completed
          </p>
        </div>
      )}

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">In Progress</h2>
          {activeGoals.map(goal => {
            const overdue = isOverdue(goal)
            const days = daysUntilDeadline(goal)
            return (
              <div
                key={goal.id}
                className={`rounded-2xl bg-white border shadow-sm p-4 space-y-2 ${
                  overdue ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${PRIORITY_DOTS[goal.priority]}`} />
                    <p className="text-sm font-semibold text-gray-900 truncate">{goal.title}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLOURS[goal.category]}`}>
                    {goal.category}
                  </span>
                </div>
                {goal.description && (
                  <p className="text-xs text-muted-foreground pl-4">{goal.description}</p>
                )}
                {goal.deadline && (
                  <div className="pl-4">
                    {overdue ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        <AlertCircle size={10} />
                        Overdue
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {days !== null && days <= 7
                          ? `${days === 0 ? 'Due today' : `${days}d left`}`
                          : new Date(goal.deadline).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })
                        }
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Done / abandoned */}
      {doneGoals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <CheckCircle2 size={14} className="text-gray-400" />
            Completed &amp; Archived
          </h2>
          {doneGoals.map(goal => (
            <div
              key={goal.id}
              className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between gap-2"
            >
              <p className={`text-sm truncate ${goal.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-500'}`}>
                {goal.title}
              </p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                goal.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {goal.status === 'completed' ? 'Done' : 'Abandoned'}
              </span>
            </div>
          ))}
        </div>
      )}

      {allGoals.length === 0 && (
        <div className="rounded-2xl border bg-white p-8 text-center space-y-2">
          <Flag size={36} className="text-gray-300 mx-auto" />
          <p className="font-semibold text-gray-700">No goals set yet</p>
          <p className="text-sm text-muted-foreground">
            Goals will appear here once the student adds them.
          </p>
        </div>
      )}
    </div>
  )
}
