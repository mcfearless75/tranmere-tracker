import { createAdminClient } from '@/lib/supabase/admin'
import { AddUnitForm } from './AddUnitForm'
import { PopulateUnitsButton } from './PopulateUnitsButton'

export const dynamic = 'force-dynamic'

export default async function CoursesPage() {
  const supabase = createAdminClient()
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, btec_units(id, unit_number, unit_name)')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Courses &amp; Units</h1>
          <p className="text-sm text-muted-foreground">
            The three BTEC courses are pre-seeded. Add units manually below, or populate official BTEC unit lists in one click.
          </p>
        </div>
        <PopulateUnitsButton />
      </div>

      {courses?.map(course => (
        <div key={course.id} className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-tranmere-blue">{course.name}</h2>

          {(course.btec_units as any[])?.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 text-muted-foreground font-medium w-24">Unit</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Name</th>
                </tr>
              </thead>
              <tbody>
                {(course.btec_units as any[])
                  .sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }))
                  .map(u => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-sm text-muted-foreground">{u.unit_number}</td>
                      <td className="py-2">{u.unit_name}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No units added yet.</p>
          )}

          <AddUnitForm courseId={course.id} />
        </div>
      ))}
    </div>
  )
}
