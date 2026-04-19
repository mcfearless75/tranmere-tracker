'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Download, Filter, Check } from 'lucide-react'
import { toCSV, downloadCSV } from '@/lib/csv'

type Student = { id: string; name: string | null; role: string; course_id: string | null; courses: { name: string } | null }
type Course = { id: string; name: string }

const METRICS = [
  { key: 'coursework', label: 'Coursework completion %' },
  { key: 'avgGrade',   label: 'Average grade (Pass=1, Merit=2, Distinction=3)' },
  { key: 'gps',        label: 'GPS session count (30d)' },
  { key: 'distance',   label: 'Total distance (30d, km)' },
  { key: 'topSpeed',   label: 'Max top speed (km/h)' },
  { key: 'sprints',    label: 'Total sprints (30d)' },
  { key: 'matches',    label: 'Matches played (30d)' },
  { key: 'goals',      label: 'Goals scored (30d)' },
  { key: 'assists',    label: 'Assists (30d)' },
  { key: 'avgRating',  label: 'Average self-rating' },
  { key: 'nutrition',  label: 'Nutrition logs (30d)' },
  { key: 'training',   label: 'Training logs (30d)' },
] as const

type MetricKey = typeof METRICS[number]['key']

export function ReportBuilderClient({ students, courses }: { students: Student[]; courses: Course[] }) {
  const [roleFilter, setRoleFilter] = useState<string>('student')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricKey>>(new Set<MetricKey>(['coursework', 'gps', 'distance', 'matches']))
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Record<string, any>[] | null>(null)

  function toggleMetric(k: MetricKey) {
    setSelectedMetrics(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }

  const filteredStudents = useMemo(() => students.filter(s => {
    if (roleFilter !== 'all' && s.role !== roleFilter) return false
    if (courseFilter !== 'all' && s.course_id !== courseFilter) return false
    return true
  }), [students, roleFilter, courseFilter])

  async function run() {
    if (selectedMetrics.size === 0) return
    setLoading(true)
    const res = await fetch('/api/admin/report-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentIds: filteredStudents.map(s => s.id),
        metrics: Array.from(selectedMetrics),
      }),
    })
    const data = await res.json()
    setRows(data.rows ?? [])
    setLoading(false)
  }

  function exportCSV() {
    if (!rows) return
    downloadCSV(`custom-report-${new Date().toISOString().slice(0,10)}`, toCSV(rows))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Filters + metrics */}
      <div className="lg:col-span-1 space-y-4">
        <div className="rounded-2xl border bg-white p-5 space-y-3">
          <p className="font-semibold flex items-center gap-1.5">
            <Filter size={14} /> Filters
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Role</label>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
              <option value="all">All roles</option>
              <option value="student">Students</option>
              <option value="coach">Coaches</option>
              <option value="teacher">Teachers</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Course</label>
            <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
              <option value="all">All courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t">
            <strong>{filteredStudents.length}</strong> matches
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 space-y-2">
          <p className="font-semibold">Metrics to Include</p>
          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {METRICS.map(m => {
              const checked = selectedMetrics.has(m.key)
              return (
                <button
                  key={m.key}
                  onClick={() => toggleMetric(m.key)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition ${
                    checked ? 'bg-blue-50 ring-1 ring-tranmere-blue' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                    checked ? 'bg-tranmere-blue' : 'border border-gray-300'
                  }`}>
                    {checked && <Check size={10} className="text-white" />}
                  </div>
                  <span className="flex-1">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading || selectedMetrics.size === 0 || filteredStudents.length === 0}
          className="w-full rounded-lg bg-tranmere-blue text-white px-4 py-3 font-semibold hover:bg-blue-900 disabled:opacity-50"
        >
          {loading ? 'Running…' : 'Build Report'}
        </button>
      </div>

      {/* Results */}
      <div className="lg:col-span-2 space-y-4">
        {!rows && (
          <div className="rounded-2xl border bg-white p-12 text-center">
            <p className="font-semibold text-muted-foreground">Pick filters + metrics and hit &ldquo;Build Report&rdquo;</p>
            <p className="text-xs text-muted-foreground mt-1">Results appear here. Export to CSV with one click.</p>
          </div>
        )}
        {rows && rows.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm"><strong>{rows.length}</strong> rows</p>
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-1.5 rounded-lg bg-tranmere-blue text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-900"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div className="rounded-2xl border bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-xs text-muted-foreground sticky top-0">
                  <tr>
                    {Object.keys(rows[0]).map(h => (
                      <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      {Object.entries(r).map(([k, v], j) => (
                        <td key={j} className="px-3 py-1.5 whitespace-nowrap">
                          {k === 'Student' && r.id ? (
                            <Link href={`/admin/students/${r.id}`} className="text-tranmere-blue hover:underline font-medium">{String(v)}</Link>
                          ) : (
                            String(v ?? '—')
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
