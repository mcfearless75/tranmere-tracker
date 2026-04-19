import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { UnitStudentGrid } from './UnitStudentGrid'

export const dynamic = 'force-dynamic'

export default async function UnitDetailPage({ params }: { params: { unitId: string } }) {
  const supabase = createAdminClient()

  const { data: unit } = await supabase
    .from('btec_units')
    .select('id, unit_number, unit_name, course_id, courses(name)')
    .eq('id', params.unitId)
    .single()

  if (!unit) notFound()

  const [{ data: assignments }, { data: students }, { data: submissions }] = await Promise.all([
    supabase.from('assignments').select('id, title, description, due_date, grade_target').eq('unit_id', unit.id).order('due_date'),
    supabase.from('users').select('id, name, avatar_url').eq('role', 'student').eq('course_id', unit.course_id).order('name'),
    supabase.from('submissions').select('id, assignment_id, student_id, status, grade, feedback'),
  ])

  const courseName = (unit.courses as any)?.name ?? ''

  return (
    <div className="space-y-5">
      <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Courses
      </Link>

      {/* Unit header */}
      <div className="rounded-2xl border bg-gradient-to-br from-tranmere-blue via-blue-800 to-indigo-900 p-5 sm:p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-widest text-blue-200">{courseName}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/15 font-mono font-bold">
            {unit.unit_number}
          </span>
          <h1 className="text-xl sm:text-2xl font-bold">{unit.unit_name}</h1>
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm text-blue-200 flex-wrap">
          <span>{assignments?.length ?? 0} assignments</span>
          <span>·</span>
          <span>{students?.length ?? 0} students enrolled</span>
        </div>
      </div>

      {/* Students on this unit */}
      {students && students.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 sm:p-5">
          <h2 className="font-semibold mb-3">Students on this unit ({students.length})</h2>
          <div className="flex flex-wrap gap-2">
            {students.map(s => {
              const initials = (s.name ?? '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
              return (
                <Link
                  key={s.id}
                  href={`/admin/students/${s.id}`}
                  className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 hover:border-tranmere-blue transition"
                >
                  {s.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-tranmere-blue text-white text-[10px] font-bold">
                      {initials}
                    </span>
                  )}
                  <span className="text-sm">{s.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Assignments with per-student matrix */}
      {assignments && assignments.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-semibold">Assignments</h2>
          {assignments.map(a => (
            <UnitStudentGrid
              key={a.id}
              assignment={a}
              students={students ?? []}
              submissions={(submissions ?? []).filter(s => s.assignment_id === a.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No assignments for this unit yet.{' '}
            <Link href="/admin/assignments" className="text-tranmere-blue underline">
              Add one
            </Link>{' '}
            or click &ldquo;Populate BTEC Assignments&rdquo; on the Assignments page.
          </p>
        </div>
      )}
    </div>
  )
}
