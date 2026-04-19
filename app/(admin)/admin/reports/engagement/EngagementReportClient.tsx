'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Download, Apple, Dumbbell, Trophy, BookOpen, Bell, BellOff } from 'lucide-react'
import { toCSV, downloadCSV } from '@/lib/csv'

type Student = { id: string; name: string | null; course_id: string | null; avatar_url: string | null; courses: { name: string } | null }
type Ref = { student_id: string; [k: string]: string | null | undefined }
type PushSub = { user_id: string }

export function EngagementReportClient({ students, nutrition, training, matches, submissions, pushSubs }: {
  students: Student[]
  nutrition: Ref[]
  training: Ref[]
  matches: Ref[]
  submissions: Ref[]
  pushSubs: PushSub[]
}) {
  const pushSet = useMemo(() => new Set(pushSubs.map(s => s.user_id)), [pushSubs])

  const stats = useMemo(() => students.map(s => {
    const lastNutrition = nutrition
      .filter(n => n.student_id === s.id)
      .map(n => n.logged_date!)
      .sort().reverse()[0] ?? null
    const lastTraining = training
      .filter(t => t.student_id === s.id)
      .map(t => t.session_date!)
      .sort().reverse()[0] ?? null
    const lastMatch = matches
      .filter(m => m.student_id === s.id)
      .map(m => m.match_date!)
      .sort().reverse()[0] ?? null
    const lastSubmission = submissions
      .filter(sb => sb.student_id === s.id && sb.status !== 'not_started')
      .map(sb => sb.submitted_at!)
      .sort().reverse()[0] ?? null

    const anyActivity = [lastNutrition, lastTraining, lastMatch, lastSubmission].filter(Boolean)
    const lastActive = anyActivity.length > 0 ? anyActivity.map(x => new Date(x!).getTime()).sort().reverse()[0] : null
    const daysInactive = lastActive ? Math.floor((Date.now() - lastActive) / 86400000) : Infinity

    return {
      student: s,
      nutritionCount: nutrition.filter(n => n.student_id === s.id).length,
      trainingCount: training.filter(t => t.student_id === s.id).length,
      matchCount: matches.filter(m => m.student_id === s.id).length,
      submissionCount: submissions.filter(sb => sb.student_id === s.id && sb.status !== 'not_started').length,
      lastNutrition, lastTraining, lastMatch, lastSubmission,
      daysInactive,
      pushEnabled: pushSet.has(s.id),
      score: 0, // computed below
    }
  }), [students, nutrition, training, matches, submissions, pushSet])

  // Engagement score: 0-100 based on activity breadth & recency
  const withScores = stats.map(s => {
    const breadth = [s.nutritionCount > 0, s.trainingCount > 0, s.matchCount > 0, s.submissionCount > 0].filter(Boolean).length
    const recencyBonus = s.daysInactive < 3 ? 30 : s.daysInactive < 7 ? 20 : s.daysInactive < 14 ? 10 : 0
    const volumeBonus = Math.min(40, s.nutritionCount + s.trainingCount * 2 + s.matchCount * 3 + s.submissionCount * 4)
    const score = Math.min(100, breadth * 10 + recencyBonus + volumeBonus)
    return { ...s, score }
  })

  const sorted = [...withScores].sort((a, b) => b.score - a.score)
  const inactive = withScores.filter(s => s.daysInactive >= 7)
  const superActive = withScores.filter(s => s.score >= 70).length
  const noPush = withScores.filter(s => !s.pushEnabled).length

  function exportCSV() {
    const rows = withScores.map(s => ({
      Student: s.student.name ?? '',
      Course: s.student.courses?.name ?? '',
      'Engagement Score': s.score,
      'Days Inactive': s.daysInactive === Infinity ? '—' : s.daysInactive,
      'Nutrition Logs (30d)': s.nutritionCount,
      'Training Logs (30d)': s.trainingCount,
      'Match Logs (30d)': s.matchCount,
      'Submissions (30d)': s.submissionCount,
      'Push Enabled': s.pushEnabled ? 'Yes' : 'No',
    }))
    downloadCSV(`engagement-${new Date().toISOString().slice(0,10)}`, toCSV(rows))
  }

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
        <Kpi label="Total Students" value={students.length.toString()} />
        <Kpi label="Super Active (70+)" value={superActive.toString()} colour="green" />
        <Kpi label="Inactive 7+ Days" value={inactive.length.toString()} colour="red" />
        <Kpi label="No Push Enabled" value={noPush.toString()} colour="amber" />
      </div>

      {/* INACTIVE BANNER */}
      {inactive.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800 mb-2">Inactive for 7+ days ({inactive.length})</p>
          <div className="flex flex-wrap gap-2">
            {inactive.slice(0, 20).map(s => (
              <Link
                key={s.student.id}
                href={`/admin/students/${s.student.id}`}
                className="inline-flex items-center gap-1.5 bg-white rounded-full px-3 py-1 text-sm border border-red-200 hover:border-red-400"
              >
                <span className="font-medium">{s.student.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.daysInactive === Infinity ? 'never' : `${s.daysInactive}d`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ENGAGEMENT TABLE */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Student</th>
              <th className="px-4 py-2 text-center"><Apple size={14} className="inline" /></th>
              <th className="px-4 py-2 text-center"><Dumbbell size={14} className="inline" /></th>
              <th className="px-4 py-2 text-center"><Trophy size={14} className="inline" /></th>
              <th className="px-4 py-2 text-center"><BookOpen size={14} className="inline" /></th>
              <th className="px-4 py-2 text-center">Push</th>
              <th className="px-4 py-2 text-right">Last Active</th>
              <th className="px-4 py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => (
              <tr key={s.student.id} className={`border-b last:border-0 hover:bg-gray-50 ${s.daysInactive >= 14 ? 'bg-red-50/30' : ''}`}>
                <td className="px-4 py-2">
                  <Link href={`/admin/students/${s.student.id}`} className="text-tranmere-blue hover:underline font-medium">
                    {s.student.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-center text-xs">{s.nutritionCount}</td>
                <td className="px-4 py-2 text-center text-xs">{s.trainingCount}</td>
                <td className="px-4 py-2 text-center text-xs">{s.matchCount}</td>
                <td className="px-4 py-2 text-center text-xs">{s.submissionCount}</td>
                <td className="px-4 py-2 text-center">
                  {s.pushEnabled ? (
                    <Bell size={14} className="inline text-green-600" />
                  ) : (
                    <BellOff size={14} className="inline text-gray-300" />
                  )}
                </td>
                <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                  {s.daysInactive === Infinity ? 'Never' : s.daysInactive === 0 ? 'Today' : `${s.daysInactive}d ago`}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full ${s.score >= 70 ? 'bg-green-500' : s.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold w-8 text-right">{s.score}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Icons: 🍎 Nutrition logs · 💪 Training · 🏆 Matches · 📚 Coursework submissions · 🔔 Push enabled
      </p>
    </div>
  )
}

function Kpi({ label, value, colour = 'blue' }: { label: string; value: string; colour?: 'blue' | 'green' | 'red' | 'amber' }) {
  const colours = {
    blue:  'from-blue-50 to-blue-100 text-blue-700',
    green: 'from-green-50 to-emerald-100 text-green-700',
    red:   'from-red-50 to-red-100 text-red-700',
    amber: 'from-amber-50 to-amber-100 text-amber-700',
  }[colour]
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colours} p-4`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  )
}
