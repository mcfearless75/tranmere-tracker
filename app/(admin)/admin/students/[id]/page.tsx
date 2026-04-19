import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowLeft, Route, Gauge, Zap, Trophy } from 'lucide-react'
import { UnitProgress } from './UnitProgress'
import { AdminActions } from './AdminActions'

export const dynamic = 'force-dynamic'

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const studentId = params.id

  // Student profile
  const { data: student } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, role, course_id, courses(name)')
    .eq('id', studentId)
    .single()

  if (!student) {
    return (
      <div className="text-center py-16">
        <p className="font-semibold">Student not found.</p>
        <Link href="/admin/users" className="text-tranmere-blue underline mt-2 inline-block">Back to Users</Link>
      </div>
    )
  }

  // All units for this student's course, plus assignments & submissions
  const [
    { data: units },
    { data: assignments },
    { data: submissions },
    { data: gpsSessions },
    { data: matches },
  ] = await Promise.all([
    supabase
      .from('btec_units')
      .select('id, unit_number, unit_name')
      .eq('course_id', student.course_id)
      .order('unit_number'),
    supabase
      .from('assignments')
      .select('id, unit_id, title, due_date, grade_target'),
    supabase
      .from('submissions')
      .select('id, assignment_id, status, grade, feedback, submitted_at')
      .eq('student_id', studentId),
    supabase
      .from('gps_sessions')
      .select('id, session_date, session_label, total_distance_m, max_speed_kmh, sprint_count')
      .eq('player_id', studentId)
      .order('session_date', { ascending: false })
      .limit(5),
    supabase
      .from('match_logs')
      .select('id, match_date, opponent, goals, assists, self_rating')
      .eq('student_id', studentId)
      .order('match_date', { ascending: false })
      .limit(5),
  ])

  // Compute overall stats
  const allSubs = submissions ?? []
  const gradeCounts = {
    Distinction: allSubs.filter(s => s.grade === 'Distinction').length,
    Merit: allSubs.filter(s => s.grade === 'Merit').length,
    Pass: allSubs.filter(s => s.grade === 'Pass').length,
    Refer: allSubs.filter(s => s.grade === 'Refer').length,
  }
  const submitted = allSubs.filter(s => ['submitted', 'graded'].includes(s.status)).length
  const totalCourseAssignments = (assignments ?? []).filter(a =>
    (units ?? []).some(u => u.id === a.unit_id)
  ).length
  const progressPct = totalCourseAssignments > 0
    ? Math.round((submitted / totalCourseAssignments) * 100)
    : 0

  const initials = student.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'S'
  const courseName = (student.courses as any)?.name ?? 'No course assigned'

  return (
    <div className="space-y-5">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Back to Users
      </Link>

      {/* Header */}
      <div className="rounded-2xl border bg-white p-5 flex items-center gap-4">
        {student.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={student.avatar_url} alt={student.name ?? ''} className="w-20 h-20 rounded-full object-cover ring-4 ring-blue-50" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-blue-50">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-tranmere-blue">{student.name}</h1>
          <p className="text-sm text-muted-foreground">{courseName} · <span className="capitalize">{student.role}</span></p>
        </div>
      </div>

      {/* Progress summary */}
      <div className="rounded-2xl border bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Coursework Progress</h2>
          <p className="text-2xl font-bold text-tranmere-blue">{progressPct}%</p>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-tranmere-blue to-blue-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="grid grid-cols-4 gap-2 pt-2">
          <GradePill label="Distinction" count={gradeCounts.Distinction} colour="purple" />
          <GradePill label="Merit" count={gradeCounts.Merit} colour="blue" />
          <GradePill label="Pass" count={gradeCounts.Pass} colour="green" />
          <GradePill label="Pending" count={totalCourseAssignments - submitted} colour="amber" />
        </div>
      </div>

      {/* Units accordion */}
      <div className="space-y-2">
        <h2 className="font-semibold px-1">BTEC Units &amp; Assignments</h2>
        <UnitProgress
          studentId={student.id}
          studentName={student.name ?? ''}
          units={units ?? []}
          assignments={assignments ?? []}
          submissions={submissions ?? []}
        />
      </div>

      {/* Admin actions */}
      <AdminActions userId={student.id} userName={student.name ?? 'User'} email={student.email ?? ''} />

      {/* Bottom row — GPS & Matches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-5">
          <h3 className="font-semibold flex items-center gap-1.5 mb-3">
            <Route size={16} className="text-tranmere-blue" /> Recent GPS
          </h3>
          {gpsSessions && gpsSessions.length > 0 ? (
            <ul className="space-y-2">
              {gpsSessions.map(s => (
                <li key={s.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                  <div>
                    <p className="font-medium">{s.session_label ?? 'Session'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1"><Route size={12} /> {s.total_distance_m ? (s.total_distance_m / 1000).toFixed(1) : '—'} km</span>
                    <span className="flex items-center gap-1"><Gauge size={12} /> {s.max_speed_kmh ?? '—'}</span>
                    <span className="flex items-center gap-1"><Zap size={12} /> {s.sprint_count ?? 0}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No GPS sessions yet.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <h3 className="font-semibold flex items-center gap-1.5 mb-3">
            <Trophy size={16} className="text-tranmere-blue" /> Recent Matches
          </h3>
          {matches && matches.length > 0 ? (
            <ul className="space-y-2">
              {matches.map(m => (
                <li key={m.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                  <div>
                    <p className="font-medium">vs {m.opponent}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="text-xs text-right">
                    <p className="font-bold">{m.goals}G {m.assists}A</p>
                    {m.self_rating && <p className="text-muted-foreground">{m.self_rating}/10</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No matches logged yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function GradePill({ label, count, colour }: { label: string; count: number; colour: 'purple' | 'blue' | 'green' | 'amber' }) {
  const colours = {
    purple: 'bg-purple-50 text-purple-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
  }[colour]
  return (
    <div className={`rounded-lg px-2 py-2 text-center ${colours}`}>
      <p className="text-lg font-bold">{count}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide">{label}</p>
    </div>
  )
}
