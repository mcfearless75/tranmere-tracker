import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { getStatusLabel, isOverdue, sortPlans } from '@/lib/idp/idpUtils'
import type { IdpPlan } from '@/lib/idp/idpUtils'

export const dynamic = 'force-dynamic'

export default async function AdminStudentIdpPage({ params }: { params: { id: string } }) {
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
    .from('idp_plans')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  const plans = sortPlans((data ?? []) as IdpPlan[])
  const activePlans = plans.filter(p => p.status === 'active')
  const otherPlans = plans.filter(p => p.status !== 'active')

  return (
    <div className="space-y-5">
      <Link
        href={`/admin/students/${studentId}`}
        className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline"
      >
        <ArrowLeft size={14} /> Back to {student.name}
      </Link>

      <div className="flex items-center gap-2">
        <BookOpen size={20} className="text-tranmere-blue" />
        <div>
          <h1 className="text-xl font-bold text-tranmere-blue">
            Development Plans — {student.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Read-only view of {student.name}&apos;s individual development plans
          </p>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center space-y-2">
          <BookOpen size={36} className="text-gray-300 mx-auto" />
          <p className="font-semibold text-gray-700">No plans yet</p>
          <p className="text-sm text-muted-foreground">
            Plans will appear here once the student adds them.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active */}
          {activePlans.length > 0 && (
            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-gray-700">Active ({activePlans.length})</h2>
              <ul className="space-y-3">
                {activePlans.map(plan => {
                  const overdue = isOverdue(plan)
                  return (
                    <li
                      key={plan.id}
                      className={`rounded-xl border p-3.5 ${overdue ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{plan.title}</p>
                        {overdue && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-100 border border-red-300 rounded-full px-2 py-0.5">
                            Overdue
                          </span>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed">{plan.description}</p>
                      )}
                      {plan.target_date && (
                        <p className={`text-xs mt-1.5 font-medium ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                          Target: {new Date(plan.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Completed / paused */}
          {otherPlans.length > 0 && (
            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3 opacity-70">
              <h2 className="text-sm font-bold text-gray-700">Completed &amp; Paused ({otherPlans.length})</h2>
              <ul className="space-y-2">
                {otherPlans.map(plan => (
                  <li key={plan.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-700">{plan.title}</p>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-300 rounded-full px-2 py-0.5">
                        {getStatusLabel(plan.status)}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap leading-relaxed">{plan.description}</p>
                    )}
                    {plan.target_date && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        Target: {new Date(plan.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
