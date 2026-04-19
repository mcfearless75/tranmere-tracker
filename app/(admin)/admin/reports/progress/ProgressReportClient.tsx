'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangle, Download, Filter, TrendingDown, TrendingUp } from 'lucide-react'
import { toCSV, downloadCSV } from '@/lib/csv'

type Student = { id: string; name: string | null; course_id: string | null; avatar_url: string | null; courses: { name: string } | null }
type Course = { id: string; name: string }
type Unit = { id: string; unit_number: string; unit_name: string; course_id: string }
type Assignment = { id: string; unit_id: string; title: string; due_date: string }
type Submission = { student_id: string; assignment_id: string; status: string; grade: string | null }

const gradeScore: Record<string, number> = { Distinction: 3, Merit: 2, Pass: 1, Refer: 0 }
const gradeBg: Record<string, string> = {
  Distinction: 'bg-purple-600 text-white',
  Merit: 'bg-blue-600 text-white',
  Pass: 'bg-green-600 text-white',
  Refer: 'bg-red-400 text-white',
  submitted: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  not_started: 'bg-gray-100 text-gray-400',
}

export function ProgressReportClient({ students, courses, units, assignments, submissions }: {
  students: Student[]; courses: Course[]; units: Unit[]; assignments: Assignment[]; submissions: Submission[]
}) {
  const [courseFilter, setCourseFilter] = useState<string>('all')

  const filteredStudents = useMemo(
    () => courseFilter === 'all' ? students : students.filter(s => s.course_id === courseFilter),
    [courseFilter, students],
  )
  const filteredUnits = useMemo(
    () => courseFilter === 'all' ? units : units.filter(u => u.course_id === courseFilter),
    [courseFilter, units],
  )

  // Per-student stats
  const studentStats = useMemo(() => filteredStudents.map(s => {
    const courseUnits = units.filter(u => u.course_id === s.course_id)
    const courseAssignments = assignments.filter(a => courseUnits.some(u => u.id === a.unit_id))
    const subs = submissions.filter(sub => sub.student_id === s.id)
    const submitted = subs.filter(sub => ['submitted', 'graded'].includes(sub.status)).length
    const graded = subs.filter(sub => sub.grade)
    const avgScore = graded.length > 0
      ? graded.reduce((sum, g) => sum + (gradeScore[g.grade!] ?? 0), 0) / graded.length
      : null
    const overdue = courseAssignments.filter(a => {
      const sub = subs.find(sub => sub.assignment_id === a.id)
      return new Date(a.due_date) < new Date() && (!sub || ['not_started', 'in_progress'].includes(sub.status))
    }).length
    const pct = courseAssignments.length > 0 ? Math.round((submitted / courseAssignments.length) * 100) : 0
    return {
      student: s,
      total: courseAssignments.length,
      submitted,
      overdue,
      avgScore,
      pct,
      atRisk: overdue >= 2 || (pct < 40 && courseAssignments.length > 0),
    }
  }), [filteredStudents, units, assignments, submissions])

  const atRisk = studentStats.filter(s => s.atRisk)
  const topPerformers = [...studentStats].filter(s => s.avgScore != null).sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0)).slice(0, 5)

  // Grade heatmap — rows: students, columns: assignments (grouped by unit)
  const assignmentsByUnit = useMemo(() => {
    return filteredUnits.map(u => ({
      unit: u,
      assignments: assignments.filter(a => a.unit_id === u.id),
    })).filter(g => g.assignments.length > 0)
  }, [filteredUnits, assignments])

  function exportCSV() {
    const rows = studentStats.map(s => ({
      Student: s.student.name ?? '',
      Course: s.student.courses?.name ?? '',
      'Total Assignments': s.total,
      Submitted: s.submitted,
      Overdue: s.overdue,
      'Completion %': s.pct,
      'Avg Grade Score (0-3)': s.avgScore?.toFixed(2) ?? '',
      'At Risk': s.atRisk ? 'YES' : '',
    }))
    downloadCSV(`student-progress-${new Date().toISOString().slice(0,10)}`, toCSV(rows))
  }

  return (
    <div className="space-y-5">
      {/* FILTERS + EXPORT */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <select
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="all">All courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-sm text-muted-foreground">· {filteredStudents.length} students</span>
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 rounded-lg bg-tranmere-blue text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-900"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Students tracked" value={filteredStudents.length.toString()} colour="blue" />
        <KpiCard label="At Risk" value={atRisk.length.toString()} colour="red" icon={<AlertTriangle size={14} />} />
        <KpiCard
          label="Avg Completion"
          value={`${studentStats.length > 0 ? Math.round(studentStats.reduce((s, x) => s + x.pct, 0) / studentStats.length) : 0}%`}
          colour="green"
        />
        <KpiCard
          label="Overdue"
          value={studentStats.reduce((s, x) => s + x.overdue, 0).toString()}
          colour="amber"
        />
      </div>

      {/* AT-RISK BANNER */}
      {atRisk.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4">
          <p className="font-semibold text-red-800 flex items-center gap-2 mb-2">
            <AlertTriangle size={16} /> At-risk students ({atRisk.length})
          </p>
          <p className="text-xs text-red-700 mb-3">Flagged for 2+ overdue or less than 40% completion</p>
          <div className="flex flex-wrap gap-2">
            {atRisk.map(s => (
              <Link
                key={s.student.id}
                href={`/admin/students/${s.student.id}`}
                className="inline-flex items-center gap-1.5 bg-white rounded-full px-3 py-1 text-sm border border-red-200 hover:border-red-400"
              >
                <TrendingDown size={12} className="text-red-500" />
                <span className="font-medium">{s.student.name}</span>
                <span className="text-xs text-muted-foreground">{s.pct}% · {s.overdue} overdue</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* TOP PERFORMERS */}
      {topPerformers.length > 0 && (
        <div className="rounded-2xl border bg-white p-4">
          <p className="font-semibold flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-green-600" /> Top Performers
          </p>
          <div className="flex flex-wrap gap-2">
            {topPerformers.map((s, i) => (
              <Link
                key={s.student.id}
                href={`/admin/students/${s.student.id}`}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-full px-3 py-1 text-sm border border-green-200 hover:border-green-400"
              >
                <span className="text-xs font-bold text-green-700">#{i + 1}</span>
                <span className="font-medium">{s.student.name}</span>
                <span className="text-xs text-muted-foreground">{s.avgScore?.toFixed(1)}/3.0</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* HEATMAP */}
      <div className="rounded-2xl border bg-white p-4 overflow-hidden">
        <p className="font-semibold mb-1">Grade Heatmap</p>
        <p className="text-xs text-muted-foreground mb-3">Each cell is one assignment. Colour = grade or status.</p>
        <div className="flex gap-3 text-xs mb-3 flex-wrap">
          <LegendCell label="Distinction" classes={gradeBg.Distinction} />
          <LegendCell label="Merit" classes={gradeBg.Merit} />
          <LegendCell label="Pass" classes={gradeBg.Pass} />
          <LegendCell label="Refer" classes={gradeBg.Refer} />
          <LegendCell label="Submitted" classes={gradeBg.submitted} />
          <LegendCell label="In Progress" classes={gradeBg.in_progress} />
          <LegendCell label="Not Started" classes={gradeBg.not_started} />
        </div>
        <div className="overflow-auto">
          <table className="text-sm">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="text-left px-2 py-2 font-semibold sticky left-0 bg-white z-10 min-w-[140px]">Student</th>
                {assignmentsByUnit.map(g => (
                  <th key={g.unit.id} colSpan={g.assignments.length} className="px-1 py-1 text-xs text-center border-l">
                    <span className="font-mono text-muted-foreground">{g.unit.unit_number}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {studentStats.map(row => (
                <tr key={row.student.id} className="border-t">
                  <td className="px-2 py-1 sticky left-0 bg-white z-10">
                    <Link
                      href={`/admin/students/${row.student.id}`}
                      className="text-tranmere-blue hover:underline text-sm font-medium whitespace-nowrap"
                    >
                      {row.student.name}
                    </Link>
                  </td>
                  {assignmentsByUnit.map(g => (
                    g.assignments.map(a => {
                      const sub = submissions.find(s => s.student_id === row.student.id && s.assignment_id === a.id)
                      const key = sub?.grade ?? sub?.status ?? 'not_started'
                      return (
                        <td key={a.id} className="p-0.5 border-l">
                          <div
                            title={`${a.title}: ${sub?.grade ?? sub?.status ?? 'not started'}`}
                            className={`h-6 w-6 rounded ${gradeBg[key] ?? gradeBg.not_started} flex items-center justify-center text-[10px] font-bold`}
                          >
                            {sub?.grade?.[0] ?? ''}
                          </div>
                        </td>
                      )
                    })
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLE SUMMARY */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Student</th>
              <th className="px-4 py-2 text-left">Course</th>
              <th className="px-4 py-2 text-right">Completion</th>
              <th className="px-4 py-2 text-right">Overdue</th>
              <th className="px-4 py-2 text-right">Avg Grade</th>
            </tr>
          </thead>
          <tbody>
            {studentStats.map(row => (
              <tr key={row.student.id} className={`border-b last:border-0 hover:bg-gray-50 ${row.atRisk ? 'bg-red-50/50' : ''}`}>
                <td className="px-4 py-2">
                  <Link href={`/admin/students/${row.student.id}`} className="text-tranmere-blue hover:underline font-medium">
                    {row.student.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{row.student.courses?.name ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full ${row.pct < 40 ? 'bg-red-500' : row.pct < 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{row.pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  {row.overdue > 0 ? (
                    <span className="text-red-600 font-semibold">{row.overdue}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-semibold">
                  {row.avgScore != null ? row.avgScore.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ label, value, colour, icon }: { label: string; value: string; colour: 'blue'|'red'|'green'|'amber'; icon?: React.ReactNode }) {
  const colours = {
    blue:  'from-blue-50 to-blue-100 text-blue-700',
    red:   'from-red-50 to-red-100 text-red-700',
    green: 'from-green-50 to-emerald-100 text-green-700',
    amber: 'from-amber-50 to-amber-100 text-amber-700',
  }[colour]
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colours} p-4`}>
      <p className="text-xs font-medium flex items-center gap-1.5">{icon}{label}</p>
      <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  )
}

function LegendCell({ label, classes }: { label: string; classes: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-3 h-3 rounded ${classes}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  )
}
