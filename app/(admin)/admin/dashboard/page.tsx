import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, AlertTriangle, BookOpen, CheckCircle, Clock, MessageSquare } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function StaffDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('name, role, avatar_url').eq('id', user.id).single()
  if (!profile || !['coach', 'teacher', 'admin'].includes(profile.role)) redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  const firstName = profile.name?.split(' ')[0] ?? 'Coach'
  const isTeacher = profile.role === 'teacher'

  // ── SHARED: Upcoming matches ──────────────────────────────────────────
  const { data: upcomingMatches } = await admin
    .from('match_events')
    .select('id, opponent, match_date, location, home_score, away_score, status')
    .gte('match_date', today)
    .order('match_date')
    .limit(5)

  // ── COACH: Squad responses for next match ─────────────────────────────
  let squadSummary: { accepted: number; declined: number; pending: number } | null = null
  let missedCoursework: any[] = []

  if (!isTeacher && upcomingMatches?.length) {
    const nextMatchId = upcomingMatches[0].id
    const { data: squad } = await admin
      .from('match_squads')
      .select('status, users:player_id(name)')
      .eq('match_id', nextMatchId)

    squadSummary = { accepted: 0, declined: 0, pending: 0 }
    for (const s of squad ?? []) {
      if (s.status === 'accepted') squadSummary.accepted++
      else if (s.status === 'declined') squadSummary.declined++
      else squadSummary.pending++
    }

    // Students with overdue assignments and no submission
    const { data: overdueAssignments } = await admin
      .from('assignments')
      .select('id, title, due_date')
      .lt('due_date', today)
      .order('due_date', { ascending: false })
      .limit(10)

    if (overdueAssignments?.length) {
      const { data: allSubmissions } = await admin
        .from('submissions')
        .select('assignment_id, student_id')
        .in('assignment_id', overdueAssignments.map(a => a.id))

      const { data: students } = await admin
        .from('users')
        .select('id, name')
        .eq('role', 'student')

      const submittedSet = new Set((allSubmissions ?? []).map(s => `${s.assignment_id}:${s.student_id}`))
      const alerts: { student: string; assignment: string; daysLate: number }[] = []

      for (const a of overdueAssignments.slice(0, 3)) {
        const daysLate = Math.floor((Date.now() - new Date(a.due_date).getTime()) / 86400000)
        for (const s of students ?? []) {
          if (!submittedSet.has(`${a.id}:${s.id}`)) {
            alerts.push({ student: s.name, assignment: a.title, daysLate })
          }
        }
      }
      missedCoursework = alerts.slice(0, 8)
    }
  }

  // ── TEACHER: Coursework overview ──────────────────────────────────────
  let assignments: any[] = []
  const submissionsByAssignment: Record<string, number> = {}
  let totalStudents = 0

  if (isTeacher) {
    const [{ data: assignmentData }, { data: studentCount }, { data: subData }] = await Promise.all([
      admin.from('assignments').select('id, title, due_date, unit_id').order('due_date', { ascending: false }).limit(20),
      admin.from('users').select('id', { count: 'exact' }).eq('role', 'student'),
      admin.from('submissions').select('assignment_id'),
    ])
    assignments = assignmentData ?? []
    totalStudents = (studentCount as any)?.length ?? 0
    for (const s of subData ?? []) {
      submissionsByAssignment[s.assignment_id] = (submissionsByAssignment[s.assignment_id] ?? 0) + 1
    }
  }

  // ── Upcoming assignments (for coach too) ──────────────────────────────
  const { data: upcomingAssignments } = !isTeacher ? await admin
    .from('assignments')
    .select('id, title, due_date')
    .gte('due_date', today)
    .lte('due_date', in14)
    .order('due_date')
    .limit(5) : { data: [] }

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 py-1">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-tranmere-blue shadow" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center ring-2 ring-tranmere-blue shadow">
            <span className="text-white font-bold text-sm">{(profile.name ?? 'ST').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}</span>
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-bold text-tranmere-blue">Hi, {firstName}</h1>
          <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
        </div>
        <Image
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers" width={32} height={32} className="opacity-80"
        />
      </div>

      {/* ── COACH VIEW ── */}
      {!isTeacher && (
        <>
          {/* Next match squad status */}
          {upcomingMatches && upcomingMatches.length > 0 && squadSummary && (
            <div className="rounded-2xl border bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-tranmere-blue" />
                <p className="font-semibold text-sm">Next Match — vs {upcomingMatches[0].opponent}</p>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(upcomingMatches[0].match_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {upcomingMatches[0].location ?? 'TBC'}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-green-50 border border-green-200 p-3">
                  <p className="text-xl font-bold text-green-700">{squadSummary.accepted}</p>
                  <p className="text-[10px] text-green-600 font-medium">Available</p>
                </div>
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-xl font-bold text-red-700">{squadSummary.declined}</p>
                  <p className="text-[10px] text-red-600 font-medium">Unavailable</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xl font-bold text-amber-700">{squadSummary.pending}</p>
                  <p className="text-[10px] text-amber-600 font-medium">No response</p>
                </div>
              </div>
              <Link href={`/admin/match-events/${upcomingMatches[0].id}`} className="text-xs text-tranmere-blue underline underline-offset-2">
                View full squad →
              </Link>
            </div>
          )}

          {/* Upcoming fixtures */}
          {upcomingMatches && upcomingMatches.length > 1 && (
            <div className="rounded-2xl border bg-white p-4 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2"><Calendar size={15} className="text-tranmere-blue" /> Upcoming Fixtures</p>
              {upcomingMatches.slice(1, 4).map(m => (
                <Link key={m.id} href={`/admin/match-events/${m.id}`} className="flex justify-between items-center text-sm py-1.5 border-t">
                  <span className="font-medium">vs {m.opponent}</span>
                  <span className="text-xs text-muted-foreground">{new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Missed coursework alerts */}
          {missedCoursework.length > 0 && (
            <div className="rounded-2xl border bg-white p-4 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" /> Missed Coursework
              </p>
              {missedCoursework.map((item, i) => (
                <div key={i} className="flex justify-between items-start text-sm py-1.5 border-t">
                  <div>
                    <p className="font-medium">{item.student}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.assignment}</p>
                  </div>
                  <span className="text-xs text-red-600 font-medium shrink-0">{item.daysLate}d late</span>
                </div>
              ))}
              <Link href="/admin/grade-submissions" className="text-xs text-tranmere-blue underline underline-offset-2">View all →</Link>
            </div>
          )}

          {/* Upcoming deadlines */}
          {upcomingAssignments && upcomingAssignments.length > 0 && (
            <div className="rounded-2xl border bg-white p-4 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2"><BookOpen size={15} className="text-tranmere-blue" /> Upcoming Deadlines</p>
              {upcomingAssignments.map(a => {
                const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
                return (
                  <div key={a.id} className="flex justify-between items-center text-sm py-1.5 border-t">
                    <span className="truncate pr-2">{a.title}</span>
                    <span className={`shrink-0 text-xs font-medium ${daysLeft <= 3 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── TEACHER VIEW ── */}
      {isTeacher && (
        <>
          <div className="rounded-2xl border bg-white p-4 space-y-3">
            <p className="font-semibold text-sm flex items-center gap-2"><BookOpen size={15} className="text-tranmere-blue" /> Coursework Overview</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-tranmere-blue/5 border p-3 text-center">
                <p className="text-2xl font-bold text-tranmere-blue">{assignments.length}</p>
                <p className="text-[11px] text-muted-foreground">Assignments</p>
              </div>
              <div className="rounded-xl bg-tranmere-blue/5 border p-3 text-center">
                <p className="text-2xl font-bold text-tranmere-blue">{totalStudents}</p>
                <p className="text-[11px] text-muted-foreground">Students</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white divide-y overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2">
              <CheckCircle size={15} className="text-tranmere-blue" />
              <p className="font-semibold text-sm">Assignment Submissions</p>
            </div>
            {assignments.slice(0, 10).map(a => {
              const submitted = submissionsByAssignment[a.id] ?? 0
              const pct = totalStudents > 0 ? Math.round((submitted / totalStudents) * 100) : 0
              const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
              const overdue = daysLeft < 0
              return (
                <div key={a.id} className="px-4 py-3 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <span className={`text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full ${overdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      {overdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-tranmere-blue h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{submitted}/{totalStudents}</span>
                  </div>
                </div>
              )
            })}
            <div className="px-4 py-3">
              <Link href="/admin/grade-submissions" className="text-xs text-tranmere-blue underline underline-offset-2">Grade submissions →</Link>
            </div>
          </div>

          {/* Upcoming deadlines for teacher */}
          {upcomingMatches && upcomingMatches.length > 0 && (
            <div className="rounded-2xl border bg-white p-4 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2"><Clock size={15} className="text-muted-foreground" /> Match Schedule</p>
              {upcomingMatches.slice(0, 3).map(m => (
                <div key={m.id} className="flex justify-between items-center text-sm py-1.5 border-t">
                  <span>vs {m.opponent}</span>
                  <span className="text-xs text-muted-foreground">{new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Chat shortcut */}
      <Link href="/chat" className="flex items-center gap-3 rounded-2xl border bg-white p-4 hover:bg-gray-50 transition-colors">
        <div className="w-10 h-10 rounded-full bg-tranmere-blue/10 flex items-center justify-center">
          <MessageSquare size={18} className="text-tranmere-blue" />
        </div>
        <div>
          <p className="font-semibold text-sm">Chat</p>
          <p className="text-xs text-muted-foreground">Messages &amp; squad chat</p>
        </div>
      </Link>
    </div>
  )
}
