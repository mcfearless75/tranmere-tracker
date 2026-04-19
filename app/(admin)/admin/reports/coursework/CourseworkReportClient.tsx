'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Download, AlertTriangle } from 'lucide-react'
import { toCSV, downloadCSV } from '@/lib/csv'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

type Assignment = { id: string; unit_id: string; title: string; due_date: string; grade_target: string | null; btec_units: { unit_number: string; unit_name: string; course_id: string; courses: { name: string } | null } | null }
type Submission = { id: string; assignment_id: string; student_id: string; status: string; grade: string | null; users: { name: string } | null }
type Unit = { id: string; unit_number: string; unit_name: string; course_id: string; courses: { name: string } | null }
type Student = { id: string; name: string | null; course_id: string | null }

const GRADE_COLOURS: Record<string, string> = {
  Distinction: '#7c3aed',
  Merit: '#2563eb',
  Pass: '#16a34a',
  Refer: '#dc2626',
  'Not graded': '#9ca3af',
}

export function CourseworkReportClient({ assignments, submissions, units, students }: {
  assignments: Assignment[]; submissions: Submission[]; units: Unit[]; students: Student[]
}) {
  const today = new Date().toISOString().slice(0, 10)

  // Grade distribution
  const gradeDist = useMemo(() => {
    const counts: Record<string, number> = { Distinction: 0, Merit: 0, Pass: 0, Refer: 0, 'Not graded': 0 }
    for (const s of submissions) {
      if (s.grade) counts[s.grade] = (counts[s.grade] ?? 0) + 1
      else counts['Not graded'] += 1
    }
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  }, [submissions])

  // Submission rate per unit
  const unitRates = useMemo(() => {
    return units.map(u => {
      const unitAssignments = assignments.filter(a => a.unit_id === u.id)
      const studentsInCourse = students.filter(s => s.course_id === u.course_id)
      const totalExpected = unitAssignments.length * studentsInCourse.length
      let submitted = 0, graded = 0
      for (const a of unitAssignments) {
        for (const s of studentsInCourse) {
          const sub = submissions.find(sub => sub.assignment_id === a.id && sub.student_id === s.id)
          if (sub && ['submitted', 'graded'].includes(sub.status)) submitted++
          if (sub && sub.status === 'graded') graded++
        }
      }
      return {
        unit: u,
        total: totalExpected,
        submitted,
        graded,
        rate: totalExpected > 0 ? Math.round((submitted / totalExpected) * 100) : 0,
      }
    }).filter(r => r.total > 0)
  }, [units, assignments, submissions, students])

  // Overdue list
  const overdue = useMemo(() => {
    const items: { assignment: Assignment; students: Student[] }[] = []
    for (const a of assignments) {
      if (a.due_date >= today) continue
      const expectedStudents = students.filter(s => s.course_id === a.btec_units?.course_id)
      const missing = expectedStudents.filter(s => {
        const sub = submissions.find(sub => sub.assignment_id === a.id && sub.student_id === s.id)
        return !sub || !['submitted', 'graded'].includes(sub.status)
      })
      if (missing.length > 0) items.push({ assignment: a, students: missing })
    }
    return items.sort((a, b) => a.assignment.due_date.localeCompare(b.assignment.due_date))
  }, [assignments, students, submissions])

  // Chart data — unit rates (sorted)
  const unitChartData = [...unitRates]
    .sort((a, b) => b.rate - a.rate)
    .map(r => ({
      name: `${r.unit.unit_number}`,
      fullName: `${r.unit.unit_number} ${r.unit.unit_name}`,
      course: r.unit.courses?.name ?? '',
      rate: r.rate,
    }))

  function exportCSV() {
    const rows = unitRates.map(r => ({
      Unit: r.unit.unit_number,
      'Unit Name': r.unit.unit_name,
      Course: r.unit.courses?.name ?? '',
      'Total Expected': r.total,
      Submitted: r.submitted,
      Graded: r.graded,
      'Submission Rate %': r.rate,
    }))
    downloadCSV(`coursework-analytics-${new Date().toISOString().slice(0,10)}`, toCSV(rows))
  }

  const totalSubmissions = submissions.filter(s => ['submitted', 'graded'].includes(s.status)).length
  const totalExpected = unitRates.reduce((sum, r) => sum + r.total, 0)
  const overallRate = totalExpected > 0 ? Math.round((totalSubmissions / totalExpected) * 100) : 0

  return (
    <div className="space-y-5">
      {/* EXPORT */}
      <div className="flex justify-end">
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 rounded-lg bg-tranmere-blue text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-900"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Assignments" value={assignments.length.toString()} />
        <Kpi label="Overall Submission Rate" value={`${overallRate}%`} />
        <Kpi label="Graded" value={submissions.filter(s => s.status === 'graded').length.toString()} />
        <Kpi label="Overdue" value={overdue.reduce((sum, o) => sum + o.students.length, 0).toString()} colour="red" icon={<AlertTriangle size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* GRADE DISTRIBUTION */}
        <div className="rounded-2xl border bg-white p-5">
          <p className="font-semibold mb-3">Grade Distribution</p>
          {gradeDist.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gradeDist}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    animationDuration={800}
                  >
                    {gradeDist.map(g => (
                      <Cell key={g.name} fill={GRADE_COLOURS[g.name]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-muted-foreground">No submissions yet.</p>}
          <div className="flex flex-wrap gap-3 mt-2 text-xs justify-center">
            {gradeDist.map(g => (
              <span key={g.name} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded" style={{ background: GRADE_COLOURS[g.name] }} />
                {g.name}: <strong>{g.value}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* UNIT SUBMISSION RATES */}
        <div className="rounded-2xl border bg-white p-5">
          <p className="font-semibold mb-3">Submission Rate by Unit</p>
          {unitChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={unitChartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', fontSize: 12 }} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {unitChartData.map((d, i) => (
                      <Cell key={i} fill={d.rate >= 80 ? '#16a34a' : d.rate >= 50 ? '#f59e0b' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-muted-foreground">No assignment data yet.</p>}
        </div>
      </div>

      {/* OVERDUE LIST */}
      {overdue.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-5">
          <p className="font-semibold text-red-800 flex items-center gap-2 mb-3">
            <AlertTriangle size={16} /> Overdue Assignments
          </p>
          <div className="space-y-3">
            {overdue.slice(0, 10).map(({ assignment: a, students: missing }) => (
              <div key={a.id} className="bg-white rounded-lg p-3 border border-red-100">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.btec_units?.courses?.name} · {a.btec_units?.unit_number} · Due {new Date(a.due_date).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-red-600 shrink-0">{missing.length} missing</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {missing.slice(0, 12).map(s => (
                    <Link
                      key={s.id}
                      href={`/admin/students/${s.id}`}
                      className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200 hover:border-red-400"
                    >
                      {s.name}
                    </Link>
                  ))}
                  {missing.length > 12 && (
                    <span className="text-xs text-muted-foreground">+{missing.length - 12} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UNIT TABLE */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Unit</th>
              <th className="px-4 py-2 text-left">Course</th>
              <th className="px-4 py-2 text-right">Expected</th>
              <th className="px-4 py-2 text-right">Submitted</th>
              <th className="px-4 py-2 text-right">Graded</th>
              <th className="px-4 py-2 text-right">Rate</th>
            </tr>
          </thead>
          <tbody>
            {unitRates.map(r => (
              <tr key={r.unit.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">
                  <span className="font-mono text-xs text-muted-foreground mr-2">{r.unit.unit_number}</span>
                  {r.unit.unit_name}
                </td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{r.unit.courses?.name ?? '—'}</td>
                <td className="px-4 py-2 text-right">{r.total}</td>
                <td className="px-4 py-2 text-right font-semibold">{r.submitted}</td>
                <td className="px-4 py-2 text-right">{r.graded}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full ${r.rate >= 80 ? 'bg-green-500' : r.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${r.rate}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold w-8 text-right">{r.rate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ label, value, colour = 'blue', icon }: { label: string; value: string; colour?: 'blue' | 'red'; icon?: React.ReactNode }) {
  const colours = {
    blue: 'from-blue-50 to-blue-100 text-blue-700',
    red:  'from-red-50 to-red-100 text-red-700',
  }[colour]
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colours} p-4`}>
      <p className="text-xs font-medium flex items-center gap-1.5">{icon}{label}</p>
      <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  )
}
