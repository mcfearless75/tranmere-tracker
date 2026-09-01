// app/(admin)/admin/coursework/page.tsx
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { CourseworkManager } from './CourseworkManager'
import type { BtecUnitRow, AssignmentRow } from '@/lib/coursework/courseworkUtils'

export const dynamic = 'force-dynamic'

export default async function AdminCourseworkPage({
  searchParams,
}: {
  searchParams: { course?: string; grade?: string }
}) {
  const supabase = createAdminClient()

  const { data: courses } = await supabase.from('courses').select('id, name').order('name')
  const courseList = courses ?? []
  const selectedCourseId = searchParams.course && courseList.some(c => c.id === searchParams.course)
    ? searchParams.course
    : courseList[0]?.id

  const { data: units } = selectedCourseId
    ? await supabase
        .from('btec_units')
        .select('id, course_id, unit_number, unit_name')
        .eq('course_id', selectedCourseId)
        .order('unit_number')
    : { data: [] as BtecUnitRow[] }

  const unitList = units ?? []
  const unitIds = unitList.map(u => u.id)

  const { data: assignments } = unitIds.length
    ? await supabase
        .from('assignments')
        .select('id, unit_id, title, description, due_date, grade_target')
        .in('unit_id', unitIds)
        .order('due_date')
    : { data: [] as AssignmentRow[] }

  const assignmentList = assignments ?? []

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Coursework</h1>
        <p className="text-xs text-muted-foreground">
          Manage assignment deadlines and record BTEC grades by course.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {courseList.map(course => (
          <Link
            key={course.id}
            href={`/admin/coursework?course=${course.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              course.id === selectedCourseId
                ? 'bg-tranmere-blue text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {course.name}
          </Link>
        ))}
      </div>

      <CourseworkManager units={unitList} assignments={assignmentList} />
    </div>
  )
}
