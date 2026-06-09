import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, MessageSquare, Activity, LayoutGrid, Users, GraduationCap } from 'lucide-react'
import { PushOptIn } from '@/components/PushOptIn'
import { MOODLE_TEACHER_URL } from '@/lib/config/moodle'

export const dynamic = 'force-dynamic'

export default async function StaffDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('name, role, avatar_url').eq('id', user.id).single()
  if (!profile || !['coach', 'teacher', 'admin'].includes(profile.role)) redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]
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
  let totalStudents = 0

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

    const { data: studentCount } = await admin.from('users').select('id', { count: 'exact' }).eq('role', 'student')
    totalStudents = (studentCount as any)?.length ?? 0
  }

  // ── TEACHER: Student count for headline tile ──────────────────────────
  if (isTeacher) {
    const { data: studentCount } = await admin.from('users').select('id', { count: 'exact' }).eq('role', 'student')
    totalStudents = (studentCount as any)?.length ?? 0
  }

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <PushOptIn />
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
          {/* Squad stats headline */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/admin/users"
              className="rounded-2xl border bg-white p-4 text-center hover:bg-tranmere-blue/5 hover:border-tranmere-blue/30 transition-colors group"
            >
              <p className="text-3xl font-bold text-tranmere-blue">{totalStudents}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1 group-hover:text-tranmere-blue">
                <Users size={11} /> Registered Players →
              </p>
            </Link>
            <Link
              href="/admin/match-events"
              className="rounded-2xl border bg-white p-4 text-center hover:bg-tranmere-blue/5 hover:border-tranmere-blue/30 transition-colors group"
            >
              <p className="text-3xl font-bold text-tranmere-blue">{upcomingMatches?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1 group-hover:text-tranmere-blue">
                <Calendar size={11} /> Fixtures Ahead →
              </p>
            </Link>
          </div>

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
                Manage squad →
              </Link>
            </div>
          )}

          {/* Quick actions */}
          <div className="rounded-2xl border bg-white p-4 space-y-3">
            <p className="font-semibold text-sm">Quick Actions</p>
            <div className="grid grid-cols-3 gap-2">
              <Link href="/admin/formation" className="flex flex-col items-center gap-2 rounded-xl border bg-gray-50 hover:bg-tranmere-blue/5 p-3 transition-colors text-center">
                <LayoutGrid size={20} className="text-tranmere-blue" />
                <span className="text-[11px] font-medium leading-tight">Formation Builder</span>
              </Link>
              <Link href="/admin/gps-dashboard" className="flex flex-col items-center gap-2 rounded-xl border bg-gray-50 hover:bg-tranmere-blue/5 p-3 transition-colors text-center">
                <Activity size={20} className="text-tranmere-blue" />
                <span className="text-[11px] font-medium leading-tight">Squad GPS</span>
              </Link>
              <a href={MOODLE_TEACHER_URL} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 rounded-xl border bg-gray-50 hover:bg-tranmere-blue/5 p-3 transition-colors text-center">
                <GraduationCap size={20} className="text-tranmere-blue" />
                <span className="text-[11px] font-medium leading-tight">Go to Moodle</span>
              </a>
            </div>
          </div>

          {/* Upcoming fixtures */}
          {upcomingMatches && upcomingMatches.length > 1 && (
            <div className="rounded-2xl border bg-white p-4 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2"><Calendar size={15} className="text-tranmere-blue" /> Upcoming Fixtures</p>
              {upcomingMatches.slice(1, 5).map(m => (
                <Link key={m.id} href={`/admin/match-events/${m.id}`} className="flex justify-between items-center text-sm py-1.5 border-t">
                  <span className="font-medium">vs {m.opponent}</span>
                  <span className="text-xs text-muted-foreground">{new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </Link>
              ))}
              <Link href="/admin/match-events" className="text-xs text-tranmere-blue underline underline-offset-2">All fixtures →</Link>
            </div>
          )}
        </>
      )}

      {/* ── TEACHER VIEW ── */}
      {isTeacher && (
        <>
            {/* Headline stats */}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/admin/users" className="rounded-2xl border bg-white p-4 text-center hover:bg-tranmere-blue/5 hover:border-tranmere-blue/30 transition-colors group">
                <p className="text-3xl font-bold text-tranmere-blue">{totalStudents}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1 group-hover:text-tranmere-blue">
                  <Users size={11} /> Students →
                </p>
              </Link>
              <Link href="/admin/match-events" className="rounded-2xl border bg-white p-4 text-center hover:bg-tranmere-blue/5 hover:border-tranmere-blue/30 transition-colors group">
                <p className="text-3xl font-bold text-tranmere-blue">{upcomingMatches?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1 group-hover:text-tranmere-blue">
                  <Calendar size={11} /> Fixtures Ahead →
                </p>
              </Link>
            </div>

            {/* Coursework now lives in Moodle */}
            <a
              href={MOODLE_TEACHER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border bg-white p-4 hover:bg-tranmere-blue/5 hover:border-tranmere-blue/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-tranmere-blue/10 flex items-center justify-center">
                <GraduationCap size={18} className="text-tranmere-blue" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm group-hover:text-tranmere-blue">Go to Moodle</p>
                <p className="text-xs text-muted-foreground">Coursework, assignments &amp; grading</p>
              </div>
              <span className="text-xs text-tranmere-blue font-medium">Open →</span>
            </a>

            {/* Match schedule */}
            {upcomingMatches && upcomingMatches.length > 0 && (
              <div className="rounded-2xl border bg-white p-4 space-y-2">
                <p className="font-semibold text-sm flex items-center gap-2"><Clock size={15} className="text-muted-foreground" /> Match Schedule</p>
                {upcomingMatches.slice(0, 3).map(m => (
                  <Link key={m.id} href={`/admin/match-events/${m.id}`} className="flex justify-between items-center text-sm py-1.5 border-t hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                    <span>vs {m.opponent}</span>
                    <span className="text-xs text-muted-foreground">{new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </Link>
                ))}
                <Link href="/admin/match-events" className="text-xs text-tranmere-blue underline underline-offset-2">All fixtures →</Link>
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
