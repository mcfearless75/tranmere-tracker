'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Target, Bell, Check, CheckCircle2 } from 'lucide-react'

type Assignment = { id: string; title: string; description: string | null; due_date: string; grade_target: string | null }
type Student = { id: string; name: string | null; avatar_url: string | null }
type Submission = { id: string; assignment_id: string; student_id: string; status: string; grade: string | null; feedback: string | null }

const statusMeta: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  not_started: { label: 'Not started',  dot: 'bg-gray-300',   bg: 'bg-gray-50',    text: 'text-gray-600' },
  in_progress: { label: 'In progress',  dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700' },
  submitted:   { label: 'Submitted',    dot: 'bg-blue-500',   bg: 'bg-blue-50',    text: 'text-blue-700' },
  graded:      { label: 'Graded',       dot: 'bg-green-500',  bg: 'bg-green-50',   text: 'text-green-700' },
}

const gradeBadge = (g: string | null) => {
  if (!g) return null
  const c = g === 'Distinction' ? 'bg-purple-100 text-purple-700' :
            g === 'Merit' ? 'bg-blue-100 text-blue-700' :
            g === 'Pass' ? 'bg-green-100 text-green-700' :
            'bg-red-100 text-red-700'
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c}`}>{g}</span>
}

export function UnitStudentGrid({ assignment, students, submissions }: {
  assignment: Assignment
  students: Student[]
  submissions: Submission[]
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Build student → submission map
  const bySid: Record<string, Submission | undefined> = {}
  for (const s of submissions) bySid[s.student_id] = s

  const stats = {
    notStarted: students.filter(s => !bySid[s.id] || bySid[s.id]!.status === 'not_started').length,
    inProgress: students.filter(s => bySid[s.id]?.status === 'in_progress').length,
    submitted:  students.filter(s => bySid[s.id]?.status === 'submitted').length,
    graded:     students.filter(s => bySid[s.id]?.status === 'graded').length,
  }

  const overdue = new Date(assignment.due_date) < new Date()
  const pendingStudents = students.filter(s => {
    const sub = bySid[s.id]
    return !sub || ['not_started', 'in_progress'].includes(sub.status)
  })

  async function remindAll() {
    if (pendingStudents.length === 0) return
    if (!confirm(`Send reminder to ${pendingStudents.length} student(s) who haven't submitted?`)) return
    setBusy(true)
    setMsg(null)

    const title = `Assignment due: ${assignment.title}`
    const dueStr = new Date(assignment.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    const body = overdue
      ? `This assignment was due ${dueStr}. Please submit ASAP.`
      : `Due ${dueStr}. Don't leave it to the last minute!`

    let sent = 0, failed = 0
    for (const s of pendingStudents) {
      const res = await fetch('/api/admin/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: s.id, title, body, url: '/coursework' }),
      })
      const data = await res.json()
      if (data.success) sent++; else failed++
    }
    setBusy(false)
    setMsg(`Reminders sent to ${sent}/${pendingStudents.length}${failed > 0 ? ` (${failed} had no push enabled)` : ''}`)
    setTimeout(() => setMsg(null), 4000)
  }

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">{assignment.title}</h3>
            {assignment.description && (
              <p className="text-xs text-muted-foreground mt-1">{assignment.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
              <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                <Calendar size={12} />
                Due {new Date(assignment.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {overdue && ' · Overdue'}
              </span>
              {assignment.grade_target && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Target size={12} /> Target {assignment.grade_target}
                </span>
              )}
            </div>
          </div>
          {pendingStudents.length > 0 && (
            <button
              onClick={remindAll}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-tranmere-blue text-white px-3 py-2 text-xs font-semibold hover:bg-blue-900 disabled:opacity-50 shrink-0"
            >
              <Bell size={12} />
              {busy ? 'Sending…' : `Remind ${pendingStudents.length}`}
            </button>
          )}
        </div>
        {msg && <p className="text-xs text-green-700 mt-2 flex items-center gap-1"><Check size={12} /> {msg}</p>}
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 divide-x border-b">
        <StatusCell label="Not started" count={stats.notStarted} dot="bg-gray-300" />
        <StatusCell label="In progress" count={stats.inProgress} dot="bg-amber-400" />
        <StatusCell label="Submitted"   count={stats.submitted}  dot="bg-blue-500" />
        <StatusCell label="Graded"      count={stats.graded}     dot="bg-green-500" />
      </div>

      {/* Student grid */}
      <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {students.map(s => {
          const sub = bySid[s.id]
          const status = sub?.status ?? 'not_started'
          const meta = statusMeta[status]
          const initials = (s.name ?? '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
          return (
            <Link
              key={s.id}
              href={`/admin/students/${s.id}`}
              className={`flex items-center gap-2.5 rounded-lg border p-2.5 hover:border-tranmere-blue transition ${meta.bg}`}
            >
              {s.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-tranmere-blue text-white text-xs font-bold shrink-0">
                  {initials}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className={`text-[11px] flex items-center gap-1 ${meta.text}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </p>
              </div>
              {sub?.grade && gradeBadge(sub.grade)}
              {sub?.status === 'graded' && !sub.grade && <CheckCircle2 size={14} className="text-green-600 shrink-0" />}
            </Link>
          )
        })}
        {students.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-4 text-center">
            No students assigned to this course yet.
          </p>
        )}
      </div>
    </div>
  )
}

function StatusCell({ label, count, dot }: { label: string; count: number; dot: string }) {
  return (
    <div className="p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-0.5">
        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums">{count}</p>
    </div>
  )
}
