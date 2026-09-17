'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Note = {
  id: string
  body: string
  completed: boolean
  created_at: string
  users?: { name: string } | null
}

export function WellbeingFollowup({
  surveyId,
  studentId,
  staffId,
  notes,
}: {
  surveyId: string
  studentId: string | null
  staffId: string
  notes: Note[]
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  async function addNote(completed: boolean) {
    if (!body.trim() && !completed) return
    setBusy(true)
    const supabase = createClient()
    const text = body.trim() || (completed ? 'Marked completed.' : '')
    const { error } = await supabase.from('wellbeing_staff_notes').insert({
      survey_id: surveyId,
      student_id: studentId,
      staff_id: staffId,
      body: text,
      completed,
    })
    setBusy(false)
    if (!error) {
      setBody('')
      router.refresh()
    } else {
      alert(error.message.includes('wellbeing_staff_notes')
        ? 'Run 075_match_meet_time_wellbeing_notes.sql in Supabase first.'
        : error.message)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-700">Staff follow-up (kept for GURU)</p>
      {notes.length > 0 && (
        <ul className="space-y-1.5">
          {notes.map(n => (
            <li key={n.id} className="text-xs text-gray-700">
              <span className="text-muted-foreground">
                {new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {n.users?.name ? ` · ${n.users.name}` : ''}
                {n.completed ? ' · Completed' : ''}
              </span>
              <p>{n.body}</p>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={2}
        placeholder="What was discussed / action taken"
        className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !body.trim()}
          onClick={() => addNote(false)}
          className="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold"
        >
          Add comment
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => addNote(true)}
          className="flex-1 rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          Completed
        </button>
      </div>
    </div>
  )
}
