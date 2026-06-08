import { createClient } from '@/lib/supabase/server'
import { IdpForm } from '@/components/idp/IdpForm'
import { isOverdue, sortPlans, getStatusLabel } from '@/lib/idp/idpUtils'
import type { IdpPlan } from '@/lib/idp/idpUtils'

export const dynamic = 'force-dynamic'

export default async function IdpPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('idp_plans')
    .select('*')
    .eq('student_id', user!.id)
    .order('created_at', { ascending: false })

  const plans = sortPlans((data ?? []) as IdpPlan[])
  const activePlans = plans.filter(p => p.status === 'active')
  const otherPlans = plans.filter(p => p.status !== 'active')

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-tranmere-blue">My Development Plans</h1>

      {/* Active plans */}
      {activePlans.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-700">Active</h2>
          <ul className="space-y-3">
            {activePlans.map(plan => {
              const overdue = isOverdue(plan)
              return (
                <li
                  key={plan.id}
                  className={`rounded-xl border p-3.5 ${overdue ? 'border-red-400 ring-1 ring-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{plan.title}</p>
                    {overdue && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-100 border border-red-300 rounded-full px-2 py-0.5">
                        Overdue
                      </span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap">{plan.description}</p>
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

      {/* Completed / paused plans */}
      {otherPlans.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm space-y-3 opacity-60">
          <h2 className="text-sm font-bold text-gray-700">Completed &amp; Paused</h2>
          <ul className="space-y-2">
            {otherPlans.map(plan => (
              <li key={plan.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-700 leading-snug">{plan.title}</p>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-300 rounded-full px-2 py-0.5">
                    {getStatusLabel(plan.status)}
                  </span>
                </div>
                {plan.description && (
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed whitespace-pre-wrap">{plan.description}</p>
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

      {plans.length === 0 && (
        <div className="rounded-2xl border bg-white p-8 text-center space-y-1">
          <p className="font-semibold text-gray-700">No plans yet</p>
          <p className="text-sm text-gray-400">Add your first development plan below.</p>
        </div>
      )}

      <IdpForm />
    </div>
  )
}
