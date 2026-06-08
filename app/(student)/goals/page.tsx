import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sortGoals, getCompletionRate, isOverdue, daysUntilDeadline, StudentGoal } from '@/lib/goals/goalsUtils'
import GoalForm from '@/components/goals/GoalForm'
import { Flag, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

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

function DeadlineBadge({ goal }: { goal: StudentGoal }) {
  if (!goal.deadline) return null
  const days = daysUntilDeadline(goal)
  const overdue = isOverdue(goal)

  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <AlertCircle size={10} />
        Overdue
      </span>
    )
  }

  if (days !== null && days <= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        <Clock size={10} />
        {days === 0 ? 'Due today' : `${days}d left`}
      </span>
    )
  }

  return (
    <span className="text-xs text-muted-foreground">
      {new Date(goal.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
    </span>
  )
}

export default async function GoalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('student_goals')
    .select('*')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  const allGoals = (data ?? []) as StudentGoal[]
  const sorted = sortGoals(allGoals)
  const completionRate = getCompletionRate(allGoals)

  const activeGoals = sorted.filter(g => g.status === 'in_progress')
  const doneGoals = sorted.filter(g => g.status !== 'in_progress')

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Flag size={20} className="text-tranmere-blue" />
        <div>
          <h1 className="text-xl font-bold text-tranmere-blue">My Goals</h1>
          <p className="text-xs text-muted-foreground">Set targets and track your progress</p>
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
              className="h-full bg-tranmere-blue rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {allGoals.filter(g => g.status === 'completed').length} of {allGoals.length} goals completed
          </p>
        </div>
      )}

      {/* Add form + mark-complete buttons */}
      <GoalForm activeGoals={activeGoals} />

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">In Progress</h2>
          {activeGoals.map(goal => (
            <div
              key={goal.id}
              className={`rounded-2xl bg-white border shadow-sm p-4 space-y-2 ${
                isOverdue(goal) ? 'border-red-300' : 'border-gray-200'
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
              <div className="pl-4">
                <DeadlineBadge goal={goal} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed / abandoned (collapsible) */}
      {doneGoals.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1 list-none select-none">
            <CheckCircle2 size={14} className="text-gray-400" />
            Completed &amp; Archived ({doneGoals.length})
            <span className="ml-1 text-gray-400 group-open:rotate-90 transition-transform inline-block">›</span>
          </summary>
          <div className="mt-3 space-y-2">
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
        </details>
      )}

      {allGoals.length === 0 && (
        <div className="text-center py-10 space-y-2">
          <Flag size={36} className="text-gray-300 mx-auto" />
          <p className="font-semibold text-gray-700">No goals yet</p>
          <p className="text-sm text-muted-foreground">Add your first goal above to get started.</p>
        </div>
      )}
    </div>
  )
}
