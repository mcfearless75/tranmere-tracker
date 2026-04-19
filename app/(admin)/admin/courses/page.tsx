import { createAdminClient } from '@/lib/supabase/admin'
import { AddUnitForm } from './AddUnitForm'
import { PopulateUnitsButton } from './PopulateUnitsButton'
import Link from 'next/link'
import { ChevronRight, BookOpen, Users, CheckCircle2, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Unit = { id: string; unit_number: string; unit_name: string; course_id: string }
type Assignment = { id: string; unit_id: string; due_date: string }
type Submission = { assignment_id: string; status: string }
type Student = { id: string; course_id: string | null }

export default async function CoursesPage() {
  const supabase = createAdminClient()

  const [
    { data: courses },
    { data: units },
    { data: assignments },
    { data: submissions },
    { data: students },
  ] = await Promise.all([
    supabase.from('courses').select('id, name').order('name'),
    supabase.from('btec_units').select('id, unit_number, unit_name, course_id'),
    supabase.from('assignments').select('id, unit_id, due_date'),
    supabase.from('submissions').select('assignment_id, status'),
    supabase.from('users').select('id, course_id').eq('role', 'student'),
  ])

  const today = new Date().toISOString().slice(0, 10)

  function unitStats(unit: Unit) {
    const unitAssignments = (assignments ?? []).filter(a => a.unit_id === unit.id)
    const unitStudents = (students ?? []).filter(s => s.course_id === unit.course_id)
    const totalExpected = unitAssignments.length * unitStudents.length

    let submitted = 0, pending = 0, overdue = 0
    for (const a of unitAssignments) {
      for (const s of unitStudents) {
        const sub = (submissions ?? []).find(sb => sb.assignment_id === a.id && (sb as any).student_id === s.id)
        // Note: submissions selection doesn't include student_id above; re-fetching below
      }
    }

    // Simpler counts using submissions table directly
    const unitSubs = (submissions ?? []).filter(sub => unitAssignments.some(a => a.id === sub.assignment_id))
    submitted = unitSubs.filter(s => ['submitted', 'graded'].includes(s.status)).length
    pending = totalExpected - submitted
    overdue = unitAssignments.filter(a => a.due_date < today).length

    return {
      assignments: unitAssignments.length,
      students: unitStudents.length,
      submitted,
      pending,
      overdue,
      pct: totalExpected > 0 ? Math.round((submitted / totalExpected) * 100) : 0,
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Courses &amp; Units</h1>
          <p className="text-sm text-muted-foreground">
            Click any unit to drill into assignments and student progress.
          </p>
        </div>
        <PopulateUnitsButton />
      </div>

      {(courses ?? []).map(course => {
        const courseUnits = (units ?? [])
          .filter(u => u.course_id === course.id)
          .sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }))
        const studentCount = (students ?? []).filter(s => s.course_id === course.id).length

        return (
          <div key={course.id} className="rounded-2xl border bg-white overflow-hidden">
            <div className="p-4 sm:p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="font-bold text-tranmere-blue">{course.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {courseUnits.length} unit{courseUnits.length !== 1 ? 's' : ''} · {studentCount} student{studentCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {courseUnits.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No units added yet.</p>
            ) : (
              <div className="divide-y">
                {courseUnits.map(u => {
                  const stats = unitStats(u)
                  return (
                    <Link
                      key={u.id}
                      href={`/admin/courses/units/${u.id}`}
                      className="flex items-center gap-3 p-3 sm:p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">{u.unit_number}</span>
                          <span className="font-medium truncate">{u.unit_name}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <BookOpen size={11} /> {stats.assignments} assignment{stats.assignments !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={11} /> {stats.students} student{stats.students !== 1 ? 's' : ''}
                          </span>
                          {stats.submitted > 0 && (
                            <span className="flex items-center gap-1 text-green-700">
                              <CheckCircle2 size={11} /> {stats.submitted} submitted
                            </span>
                          )}
                          {stats.pending > 0 && (
                            <span className="flex items-center gap-1 text-amber-700">
                              <Clock size={11} /> {stats.pending} pending
                            </span>
                          )}
                        </div>
                      </div>
                      {stats.assignments > 0 && (
                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full ${stats.pct === 100 ? 'bg-green-500' : stats.pct >= 50 ? 'bg-tranmere-blue' : 'bg-amber-500'}`}
                              style={{ width: `${stats.pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold w-8 text-right">{stats.pct}%</span>
                        </div>
                      )}
                      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                    </Link>
                  )
                })}
              </div>
            )}

            <div className="p-3 border-t bg-gray-50/50">
              <AddUnitForm courseId={course.id} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
