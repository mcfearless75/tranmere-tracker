import { createAdminClient } from '@/lib/supabase/admin'
import { CreateAssignmentForm } from './CreateAssignmentForm'
import { PopulateAssignmentsButton } from './PopulateAssignmentsButton'
import { AssignmentRow } from './AssignmentRow'

export const dynamic = 'force-dynamic'

export default async function AssignmentsPage() {
  const supabase = createAdminClient()

  const [{ data: assignments }, { data: units }] = await Promise.all([
    supabase
      .from('assignments')
      .select('id, title, description, due_date, grade_target, unit_id, btec_units(unit_name, courses(name))')
      .order('due_date'),
    supabase
      .from('btec_units')
      .select('id, unit_number, unit_name, courses(name)')
      .order('unit_number'),
  ])

  const formUnits = (units ?? []).map(u => ({
    id: u.id,
    unit_number: u.unit_number,
    unit_name: u.unit_name,
    course_name: (u.courses as any)?.name ?? '',
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Assignments</h1>
          <p className="text-xs text-muted-foreground">{assignments?.length ?? 0} total</p>
        </div>
        <PopulateAssignmentsButton />
      </div>

      <CreateAssignmentForm units={formUnits} />

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Title', 'Unit', 'Course', 'Due', 'Target', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments?.map(a => (
                <AssignmentRow
                  key={a.id}
                  assignment={a as any}
                  units={formUnits}
                />
              ))}
              {!assignments?.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No assignments yet. Use &ldquo;+ Create Assignment&rdquo; above or the AI populate button.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
