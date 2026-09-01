// app/(admin)/admin/coursework/GradeSheet.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GRADE_LABELS, VALID_COURSEWORK_GRADES, type CourseworkGrade } from '@/lib/coursework/courseworkUtils'

type Student = { id: string; name: string }
type Props = {
  assignment: { id: string; title: string }
  students: Student[]
  grades: Record<string, string | null>
}

export function GradeSheet({ assignment, students, grades }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(students.map(s => [s.id, grades[s.id] ?? '']))
  )
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    const body = {
      grades: students.map(s => ({
        student_id: s.id,
        grade: values[s.id] ? values[s.id] : null,
      })),
    }
    const res = await fetch(`/api/admin/assignments/${assignment.id}/grades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to save grades')
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
      <p className="text-sm font-semibold text-tranmere-blue">Grade: {assignment.title}</p>

      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students on this course yet.</p>
      ) : (
        <div className="space-y-2">
          {students.map(student => (
            <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
              <span className="text-sm font-medium">{student.name}</span>
              <select
                value={values[student.id] ?? ''}
                onChange={e => setValues(v => ({ ...v, [student.id]: e.target.value }))}
                className="border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
              >
                <option value="">— Ungraded —</option>
                {VALID_COURSEWORK_GRADES.map(grade => (
                  <option key={grade} value={grade}>{GRADE_LABELS[grade as CourseworkGrade]}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {students.length > 0 && (
        <button
          onClick={save}
          disabled={loading}
          className="bg-tranmere-blue text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-900 transition-colors"
        >
          {loading ? 'Saving…' : 'Save all'}
        </button>
      )}
    </div>
  )
}
