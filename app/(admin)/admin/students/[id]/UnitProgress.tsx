'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Bell, Check } from 'lucide-react'

type Unit = { id: string; unit_number: string; unit_name: string }
type Assignment = { id: string; unit_id: string; title: string; due_date: string; grade_target: string | null }
type Submission = { id: string; assignment_id: string; status: string; grade: string | null; feedback: string | null; submitted_at: string | null }

const statusMeta: Record<string, { label: string; classes: string }> = {
  not_started: { label: 'Not started',  classes: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In progress',  classes: 'bg-amber-100 text-amber-700' },
  submitted:   { label: 'Submitted',    classes: 'bg-blue-100 text-blue-700' },
  graded:      { label: 'Graded',       classes: 'bg-green-100 text-green-700' },
}

const gradeBadge = (g: string | null) => {
  if (!g) return null
  const c = g === 'Distinction' ? 'bg-purple-100 text-purple-700' :
            g === 'Merit' ? 'bg-blue-100 text-blue-700' :
            g === 'Pass' ? 'bg-green-100 text-green-700' :
            'bg-red-100 text-red-700'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c}`}>{g}</span>
}

export function UnitProgress({
  studentId,
  studentName,
  units,
  assignments,
  submissions,
}: {
  studentId: string
  studentName: string
  units: Unit[]
  assignments: Assignment[]
  submissions: Submission[]
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState<string | null>(null)

  function toggle(id: string) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function sendReminder(assignmentId: string, title: string, dueDate: string) {
    setSending(assignmentId)
    const res = await fetch('/api/admin/send-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        title: `Coursework reminder — ${studentName.split(' ')[0]}`,
        body: `"${title}" is due ${new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
        url: '/coursework',
      }),
    })
    const data = await res.json()
    setSending(null)
    if (data.success) {
      setReminderSent(prev => new Set(prev).add(assignmentId))
      setTimeout(() => setReminderSent(prev => {
        const next = new Set(prev); next.delete(assignmentId); return next
      }), 3000)
    } else {
      alert(data.error || 'Failed to send reminder')
    }
  }

  function unitStats(unitId: string) {
    const unitAssignments = assignments.filter(a => a.unit_id === unitId)
    const unitSubs = submissions.filter(s => unitAssignments.some(a => a.id === s.assignment_id))
    const done = unitSubs.filter(s => ['submitted', 'graded'].includes(s.status)).length
    return { total: unitAssignments.length, done, assignments: unitAssignments }
  }

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      {units.length === 0 && (
        <p className="p-5 text-sm text-muted-foreground">No BTEC units set for this course yet. Add them in /admin/courses.</p>
      )}
      {units.map(u => {
        const { total, done, assignments: unitAssignments } = unitStats(u.id)
        const isOpen = open.has(u.id)
        const pct = total > 0 ? Math.round((done / total) * 100) : 0

        return (
          <div key={u.id} className="border-b last:border-0">
            <button
              onClick={() => toggle(u.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
            >
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="font-mono text-xs text-muted-foreground w-10">{u.unit_number}</span>
              <span className="flex-1 font-medium">{u.unit_name}</span>
              {total > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full ${pct === 100 ? 'bg-green-500' : 'bg-tranmere-blue'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium w-10 text-right">{done}/{total}</span>
                </div>
              )}
              {total === 0 && (
                <span className="text-xs text-gray-400">No assignments</span>
              )}
            </button>

            {isOpen && unitAssignments.length > 0 && (
              <div className="bg-gray-50 border-t px-4 py-2 space-y-1">
                {unitAssignments.map(a => {
                  const sub = submissions.find(s => s.assignment_id === a.id)
                  const status = sub?.status ?? 'not_started'
                  const meta = statusMeta[status]
                  const isPending = !sub || ['not_started', 'in_progress'].includes(sub.status)
                  const overdue = new Date(a.due_date) < new Date()
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {new Date(a.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {overdue && isPending && <span className="ml-2 text-red-600 font-medium">· Overdue</span>}
                          {a.grade_target && ` · Target: ${a.grade_target}`}
                        </p>
                        {sub?.feedback && (
                          <p className="text-xs text-muted-foreground italic mt-0.5 truncate">“{sub.feedback}”</p>
                        )}
                      </div>
                      {sub?.grade && gradeBadge(sub.grade)}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.classes}`}>
                        {meta.label}
                      </span>
                      {isPending && (
                        <button
                          onClick={() => sendReminder(a.id, a.title, a.due_date)}
                          disabled={sending === a.id || reminderSent.has(a.id)}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                            reminderSent.has(a.id)
                              ? 'bg-green-100 text-green-700'
                              : 'bg-tranmere-blue text-white hover:bg-blue-900 disabled:opacity-50'
                          }`}
                        >
                          {reminderSent.has(a.id) ? (
                            <><Check size={12} /> Sent</>
                          ) : sending === a.id ? (
                            <>Sending…</>
                          ) : (
                            <><Bell size={12} /> Remind</>
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
