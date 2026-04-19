'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'

type Submission = {
  id: string
  status: string
  grade: string | null
  feedback: string | null
  student_id: string
  users: { name: string } | null
}
type Assignment = {
  id: string
  title: string
  due_date: string
  grade_target: string | null
  btec_units: { unit_number: string; unit_name: string; courses: { name: string } | null } | null
  submissions: Submission[]
}

const statusColour = (s: string) =>
  s === 'graded' ? 'bg-green-100 text-green-700' :
  s === 'submitted' ? 'bg-blue-100 text-blue-700' :
  s === 'in_progress' ? 'bg-amber-100 text-amber-700' :
  'bg-gray-100 text-gray-500'

export function GradeSubmissionsClient({ assignments }: { assignments: Assignment[] }) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(assignments[0]?.id ?? null)
  const [grades, setGrades] = useState<Record<string, string>>({})
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState<string | null>(null)

  async function aiRewrite(sub: Submission, assignment: Assignment) {
    const rough = feedbacks[sub.id] ?? sub.feedback ?? ''
    if (!rough.trim()) {
      alert('Type some rough notes first — Claude will polish them into professional feedback.')
      return
    }
    setAiBusy(sub.id)
    const res = await fetch('/api/ai/feedback-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentTitle: assignment.title,
        roughNotes: rough,
        grade: grades[sub.id] ?? sub.grade,
        gradeTarget: assignment.grade_target,
        studentName: sub.users?.name,
      }),
    })
    const data = await res.json()
    setAiBusy(null)
    if (data.error) alert(`AI error: ${data.error}`)
    else setFeedbacks(f => ({ ...f, [sub.id]: data.feedback }))
  }

  const submitted = (a: Assignment) => a.submissions.filter(s => s.status === 'submitted').length

  async function saveGrade(sub: Submission, assignmentId: string) {
    const grade = grades[sub.id] ?? sub.grade ?? ''
    const feedback = feedbacks[sub.id] ?? sub.feedback ?? ''
    setSaving(sub.id)
    const supabase = createClient()
    await supabase.from('submissions').upsert({
      id: sub.id,
      assignment_id: assignmentId,
      student_id: sub.student_id,
      grade: grade || null,
      feedback: feedback || null,
      status: grade ? 'graded' : sub.status,
    })
    setSaving(null)
    router.refresh()
  }

  if (assignments.length === 0) {
    return <p className="text-muted-foreground text-sm">No assignments found. Create assignments first.</p>
  }

  return (
    <div className="space-y-3">
      {assignments.map(a => (
        <div key={a.id} className="bg-white rounded-xl border overflow-hidden">
          <button
            onClick={() => setOpen(o => o === a.id ? null : a.id)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <div>
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {a.btec_units?.courses?.name} · Unit {a.btec_units?.unit_number}
                {' · '}Due {new Date(a.due_date).toLocaleDateString('en-GB')}
                {submitted(a) > 0 && (
                  <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                    {submitted(a)} to mark
                  </span>
                )}
              </p>
            </div>
            {open === a.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {open === a.id && (
            <div className="border-t divide-y">
              {a.submissions.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No submissions yet.</p>
              )}
              {a.submissions.map(sub => (
                <div key={sub.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{sub.users?.name ?? 'Unknown'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColour(sub.status)}`}>
                      {sub.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Grade</label>
                      <select
                        className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5"
                        defaultValue={sub.grade ?? ''}
                        onChange={e => setGrades(g => ({ ...g, [sub.id]: e.target.value }))}
                      >
                        <option value="">Not graded</option>
                        <option>Pass</option>
                        <option>Merit</option>
                        <option>Distinction</option>
                        <option>Refer</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs text-muted-foreground">Feedback</label>
                        <button
                          onClick={() => aiRewrite(sub, a)}
                          disabled={aiBusy === sub.id}
                          className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2 py-0.5 text-[10px] font-semibold shadow hover:shadow-lg disabled:opacity-50"
                        >
                          <Sparkles size={10} className={aiBusy === sub.id ? 'animate-spin' : ''} />
                          {aiBusy === sub.id ? 'Polishing…' : 'AI Polish'}
                        </button>
                      </div>
                      <textarea
                        className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 resize-none"
                        rows={4}
                        placeholder="Rough notes OK — tap AI Polish to rewrite professionally"
                        value={feedbacks[sub.id] ?? sub.feedback ?? ''}
                        onChange={e => setFeedbacks(f => ({ ...f, [sub.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => saveGrade(sub, a.id)}
                    disabled={saving === sub.id}
                    className="text-sm bg-tranmere-blue text-white px-4 py-1.5 rounded-lg disabled:opacity-50 hover:bg-blue-900"
                  >
                    {saving === sub.id ? 'Saving…' : 'Save Grade'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
