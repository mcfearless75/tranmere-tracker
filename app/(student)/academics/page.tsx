import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  calcUnitProgress,
  calcGradeBreakdown,
  overallCompletionPct,
} from '@/lib/academics/academicsUtils'
import { AcademicsChart } from '@/components/academics/AcademicsChart'
import { UnitProgressBars } from '@/components/academics/UnitProgressBars'

export const dynamic = 'force-dynamic'

interface Assignment {
  id: string
  title: string
  unit_title: string
  status: string
  grade: string | null
  due_date: string | null
}

export default async function AcademicsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, title, unit_title, status, grade, due_date')
    .eq('student_id', user.id)

  const rows: Assignment[] = assignments ?? []

  const today = new Date().toISOString().slice(0, 10)
  const overdueCount = rows.filter(
    (a) =>
      a.due_date !== null &&
      a.due_date < today &&
      !['submitted', 'graded'].includes(a.status)
  ).length

  const units = calcUnitProgress(rows)
  const breakdown = calcGradeBreakdown(rows)
  const completionPct = overallCompletionPct(units)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Academic Progress</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Your grades and unit completion</p>
      </div>

      {/* Headline completion */}
      <div className="rounded-2xl bg-gradient-to-br from-tranmere-blue to-blue-800 p-5 text-white shadow-lg">
        <p className="text-xs uppercase tracking-widest text-blue-200">Overall Completion</p>
        <p className="text-5xl font-bold mt-1">{completionPct}%</p>
        <div className="h-2 rounded-full bg-white/20 overflow-hidden mt-3">
          <div
            className="h-full bg-white transition-all duration-700"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <p className="text-xs text-blue-200 mt-2">
          Average across {units.length} unit{units.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Overdue warning */}
      {overdueCount > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">
            {overdueCount} overdue assignment{overdueCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            These are past their due date and not yet submitted.
          </p>
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No assignments found yet.
        </p>
      )}

      {/* Grade breakdown chart */}
      {rows.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Grade Breakdown</h2>
          <AcademicsChart breakdown={breakdown} />
        </div>
      )}

      {/* Unit progress bars */}
      {units.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Progress by Unit</h2>
          <UnitProgressBars units={units} />
        </div>
      )}
    </div>
  )
}
