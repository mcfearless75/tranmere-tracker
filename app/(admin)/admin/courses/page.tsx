import { createClient } from '@/lib/supabase/server'
import { AddUnitForm } from './AddUnitForm'

export default async function CoursesPage() {
  const supabase = createClient()
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, btec_units(id, unit_number, unit_name)')
    .order('name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Courses & Units</h1>
      <p className="text-sm text-muted-foreground">
        The three BTEC courses are pre-seeded. Add units to each course below.
      </p>

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
