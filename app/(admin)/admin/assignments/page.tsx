import { createClient } from '@/lib/supabase/server'
import { CreateAssignmentForm } from './CreateAssignmentForm'

export default async function AssignmentsPage() {
  const supabase = createClient()

  const [{ data: assignments }, { data: units }] = await Promise.all([
    supabase
      .from('assignments')
      .select('id, title, due_date, grade_target, btec_units(unit_name, courses(name))')
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Assignments</h1>

      <CreateAssignmentForm units={formUnits} />

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Title', 'Unit', 'Course', 'Due Date', 'Target'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments?.map(a => {
                const unit = a.btec_units as any
                const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
                return (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{a.title}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{unit?.unit_name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{unit?.courses?.name}</td>
                    <td className="px-4 py-3 text-xs">
                      <span>{new Date(a.due_date).toLocaleDateString('en-GB')}</span>
                      {daysLeft >= 0 && daysLeft <= 7 && (
                        <span className="ml-2 text-red-600 font-medium">({daysLeft}d)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{a.grade_target ?? '—'}</span>
                    </td>
                  </tr>
                )
              })}
              {!assignments?.length && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No assignments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
