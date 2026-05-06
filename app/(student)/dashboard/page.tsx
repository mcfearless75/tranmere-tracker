import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import Link from 'next/link'
import { PushOptIn } from '@/components/PushOptIn'
import { GeofenceCheckIn } from '@/components/GeofenceCheckIn'
import { Trophy, Dumbbell, Apple, Activity, CheckCircle2, Clock, Sun, Moon, CalendarDays, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let { data: profile } = await supabase
    .from('users')
    .select('name, course_id, avatar_url, courses(name)')
    .eq('id', user!.id)
    .single()

  // If profile missing, try via service client (RLS might be hiding it)
  if (!profile) {
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: existing } = await adminClient
      .from('users')
      .select('name, course_id, avatar_url, role')
      .eq('id', user!.id)
      .single()
    if (existing) {
      profile = existing as any
    } else {
      // Truly missing — INSERT (never upsert/overwrite existing roles)
      const displayName = (user!.user_metadata as any)?.full_name ?? user!.email?.split('@')[0] ?? 'Player'
      await adminClient.from('users').insert({
        id: user!.id,
        email: user!.email ?? '',
        name: displayName,
        role: 'student',
      })
      profile = { name: displayName, course_id: null, avatar_url: null, courses: null } as any
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const tomorrowDate = new Date(Date.now() + 86400000)
  const tomorrow = tomorrowDate.toISOString().split('T')[0]
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  const ago30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  // Run all independent queries in parallel — ~4x faster than sequential
  const [
    { data: upcoming },
    { data: todayFood },
    { data: squadRaw },
    { data: lastTraining },
    { data: todaySessions },
    { data: todayDaily },
    { data: tomorrowSessions },
    { data: attendedDays },
    { data: scheduledDays },
    { data: overdueAssignments },
    { data: mySubmissions },
  ] = await Promise.all([
    supabase
      .from('assignments')
      .select('id, title, due_date')
      .gte('due_date', today)
      .lte('due_date', in14)
      .order('due_date')
      .limit(3),
    supabase
      .from('nutrition_logs')
      .select('calories')
      .eq('student_id', user!.id)
      .eq('logged_date', today),
    supabase
      .from('match_squads')
      .select('match_id, status, match_events(id, opponent, match_date, location)')
      .eq('player_id', user!.id)
      .gte('match_events.match_date', today)
      .limit(5),
    supabase
      .from('training_logs')
      .select('session_type, session_date, duration_mins')
      .eq('student_id', user!.id)
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('attendance_sessions')
      .select('id, session_label, session_type, opens_at, closes_at')
      .eq('scheduled_date', today)
      .order('opens_at'),
    supabase
      .from('daily_attendance')
      .select('am_checked_at, pm_checked_at')
      .eq('student_id', user!.id)
      .eq('attendance_date', today)
      .maybeSingle(),
    // Tomorrow's sessions so student can plan ahead
    supabase
      .from('attendance_sessions')
      .select('id, session_label, session_type, opens_at, closes_at')
      .eq('scheduled_date', tomorrow)
      .order('opens_at'),
    // Attendance: days the student was present in the last 30 days
    supabase
      .from('daily_attendance')
      .select('attendance_date')
      .eq('student_id', user!.id)
      .gte('attendance_date', ago30)
      .lte('attendance_date', today),
    // Attendance: total scheduled days in the last 30 days
    supabase
      .from('attendance_sessions')
      .select('scheduled_date')
      .gte('scheduled_date', ago30)
      .lte('scheduled_date', today),
    // Overdue assignments (due before today)
    supabase
      .from('assignments')
      .select('id, title, due_date')
      .lt('due_date', today)
      .order('due_date', { ascending: false })
      .limit(10),
    // Student's own submissions — to cross-check overdue
    supabase
      .from('submissions')
      .select('assignment_id, status')
      .eq('student_id', user!.id),
  ])

  const totalCalories = todayFood?.reduce((sum, r) => sum + r.calories, 0) ?? 0

  const mySquadEntries = (squadRaw ?? [])
    .filter((e: any) => e.match_events?.match_date >= today)
    .sort((a: any, b: any) => new Date(a.match_events.match_date).getTime() - new Date(b.match_events.match_date).getTime())
    .slice(0, 3)

  // Attendance % — unique days present / unique days scheduled (last 30 days)
  const presentDates  = new Set((attendedDays ?? []).map(r => r.attendance_date as string))
  const scheduledDates = new Set((scheduledDays ?? []).map(r => r.scheduled_date as string))
  const attendancePct = scheduledDates.size > 0
    ? Math.round(presentDates.size / scheduledDates.size * 100)
    : null

  // Overdue = past due_date + no submitted/graded submission
  const submittedIds = new Set(
    (mySubmissions ?? [])
      .filter(s => ['submitted', 'graded'].includes(s.status))
      .map(s => s.assignment_id)
  )
  const overdueUnsubmitted = (overdueAssignments ?? []).filter(a => !submittedIds.has(a.id))

  // Does tomorrow have a match session?
  const tomorrowHasMatch = (tomorrowSessions ?? []).some(s => s.session_type === 'match')

  const firstName = profile?.name?.split(' ')[0] ?? 'Player'
  const courseName = (profile?.courses as any)?.name ?? ''
  const avatarUrl = profile?.avatar_url
  const initials = profile?.name
    ? profile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'P'

  return (
    <div className="space-y-4">
      {/* Header with user avatar */}
      <div className="flex items-center gap-3 py-2">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={profile?.name ?? 'You'}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-tranmere-blue shadow"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center ring-2 ring-tranmere-blue shadow">
            <span className="text-white font-bold text-sm">{initials}</span>
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-bold text-tranmere-blue">Hi, {firstName}</h1>
          {courseName && <p className="text-xs text-muted-foreground">{courseName}</p>}
        </div>
        <Image
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers"
          width={32}
          height={32}
          className="opacity-80"
        />
      </div>

      {/* ═══════════ TODAY'S ITINERARY — HERO ═══════════ */}
      <div className="rounded-2xl bg-gradient-to-br from-tranmere-blue to-blue-900 text-white p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-blue-200" />
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Today</p>
          <p className="ml-auto text-xs text-blue-200">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Session list */}
        {todaySessions && todaySessions.length > 0 ? (
          <div className="space-y-1.5">
            {todaySessions.map(s => {
              const opens  = new Date(s.opens_at)
              const closes = s.closes_at ? new Date(s.closes_at) : null
              const now    = new Date()
              const isPast = closes && closes <= now
              const isLive = opens <= now && (!closes || closes > now)
              return (
                <div key={s.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isLive ? 'bg-white/20 ring-1 ring-white/30' :
                  isPast ? 'bg-white/5 text-white/50' :
                           'bg-white/10'
                }`}>
                  {isPast
                    ? <CheckCircle2 size={15} className="text-blue-300/70 shrink-0" />
                    : isLive
                    ? <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                    : <Clock size={15} className="text-blue-200 shrink-0" />}
                  <span className="font-semibold truncate">{s.session_label}</span>
                  <span className={`ml-auto text-xs font-mono shrink-0 ${isLive ? 'text-white' : 'text-blue-200'}`}>
                    {opens.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {closes && `–${closes.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                  {isLive && <span className="text-[10px] font-bold bg-green-400 text-blue-900 px-1.5 py-0.5 rounded uppercase">Live</span>}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-center py-6 text-blue-100">
            <span className="text-3xl block mb-1">🏖️</span>
            <span className="text-sm font-medium">No sessions today — day off</span>
          </p>
        )}

        {/* AM / PM attendance strip */}
        <div className="flex gap-2 pt-2 border-t border-white/15">
          <div className="flex-1 flex items-center gap-2">
            {todayDaily?.am_checked_at
              ? <CheckCircle2 size={15} className="text-green-400 shrink-0" />
              : <Sun size={15} className="text-blue-200 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">AM</p>
              {todayDaily?.am_checked_at ? (
                <p className="text-xs font-semibold">
                  In {new Date(todayDaily.am_checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              ) : (
                <GeofenceCheckIn period="am" alreadyCheckedIn={false} />
              )}
            </div>
          </div>
          <div className="w-px bg-white/15" />
          <div className="flex-1 flex items-center gap-2">
            {todayDaily?.pm_checked_at
              ? <CheckCircle2 size={15} className="text-green-400 shrink-0" />
              : <Moon size={15} className="text-blue-200 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">PM</p>
              {todayDaily?.pm_checked_at ? (
                <p className="text-xs font-semibold">
                  Out {new Date(todayDaily.pm_checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              ) : (
                <GeofenceCheckIn period="pm" alreadyCheckedIn={false} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ TOMORROW PREVIEW ═══════════ */}
      <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tomorrow</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {tomorrowDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {tomorrowHasMatch && (
          <div className="flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            ⚽ Match day — pack your kit tonight
          </div>
        )}

        {tomorrowSessions && tomorrowSessions.length > 0 ? (
          <div className="space-y-0.5">
            {tomorrowSessions.map(s => {
              const opens  = new Date(s.opens_at)
              const closes = s.closes_at ? new Date(s.closes_at) : null
              const dot = s.session_type === 'match' ? 'bg-green-500' : s.session_type === 'training' ? 'bg-blue-500' : 'bg-purple-500'
              return (
                <div key={s.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <span className="font-medium flex-1 truncate">{s.session_label}</span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {opens.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {closes && `–${closes.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground flex items-center gap-2 py-1">
            <span>😴</span> Rest day — recover well
          </p>
        )}
      </div>

      {/* ═══════════ OVERDUE WARNING ═══════════ */}
      {overdueUnsubmitted.length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-red-600 shrink-0" />
            <p className="text-sm font-semibold text-red-700">
              {overdueUnsubmitted.length} overdue assignment{overdueUnsubmitted.length > 1 ? 's' : ''} — not yet submitted
            </p>
          </div>
          <div className="space-y-1">
            {overdueUnsubmitted.slice(0, 3).map(a => {
              const daysAgo = Math.ceil((Date.now() - new Date(a.due_date).getTime()) / 86400000)
              return (
                <Link key={a.id} href="/coursework" className="flex justify-between items-center text-xs py-0.5">
                  <span className="text-red-700 font-medium truncate pr-2">{a.title}</span>
                  <span className="text-red-500 shrink-0">{daysAgo}d overdue</span>
                </Link>
              )
            })}
          </div>
          {overdueUnsubmitted.length > 3 && (
            <Link href="/coursework" className="text-xs text-red-600 underline mt-1 inline-block">
              +{overdueUnsubmitted.length - 3} more →
            </Link>
          )}
        </div>
      )}

      {/* ═══════════ UPCOMING DEADLINES ═══════════ */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Upcoming Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {upcoming?.length ? upcoming.map(a => {
            const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
            return (
              <Link key={a.id} href="/coursework" className="flex justify-between items-center text-sm py-1">
                <span className="font-medium truncate pr-2">{a.title}</span>
                <span className={`shrink-0 text-xs font-medium ${daysLeft <= 3 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                </span>
              </Link>
            )
          }) : (
            <p className="text-sm text-muted-foreground">No deadlines in the next 14 days</p>
          )}
        </CardContent>
      </Card>

      {/* Upcoming matches */}
      {mySquadEntries && mySquadEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Trophy size={13} /> Upcoming Matches
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {mySquadEntries.map((entry: any) => {
              const match = entry.match_events
              if (!match) return null
              const daysLeft = Math.ceil((new Date(match.match_date).getTime() - Date.now()) / 86400000)
              const statusColour = entry.status === 'accepted' ? 'text-green-600' : entry.status === 'declined' ? 'text-red-500' : 'text-amber-500'
              return (
                <Link key={entry.match_id} href="/matches" className="flex justify-between items-center text-sm py-1">
                  <div>
                    <span className="font-medium">vs {match.opponent}</span>
                    {match.location && <span className="text-xs text-muted-foreground ml-1.5">· {match.location}</span>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}</p>
                    <p className={`text-[10px] font-medium capitalize ${statusColour}`}>{entry.status ?? 'pending'}</p>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Today&apos;s calories</p>
            <p className="text-2xl font-bold text-tranmere-blue">{totalCalories.toLocaleString()}</p>
            <Link href="/nutrition" className="text-xs text-tranmere-blue underline underline-offset-2 mt-1 inline-block">
              Log food →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Last session</p>
            {lastTraining ? (
              <>
                <p className="text-sm font-bold leading-tight capitalize">{lastTraining.session_type}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{lastTraining.duration_mins} mins</p>
              </>
            ) : (
              <Link href="/training" className="text-xs text-tranmere-blue underline underline-offset-2 inline-block mt-1">
                Log session →
              </Link>
            )}
          </CardContent>
        </Card>
        {attendancePct !== null && (
          <Card className="col-span-2">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-end justify-between mb-2">
                <p className="text-xs text-muted-foreground">Attendance — last 30 days</p>
                <p className={`text-2xl font-bold ${attendancePct >= 90 ? 'text-green-600' : attendancePct >= 75 ? 'text-amber-500' : 'text-red-600'}`}>
                  {attendancePct}%
                </p>
              </div>
              {/* progress bar */}
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${attendancePct >= 90 ? 'bg-green-500' : attendancePct >= 75 ? 'bg-amber-400' : 'bg-red-500'}`}
                  style={{ width: `${attendancePct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {presentDates.size} of {scheduledDates.size} days
                {attendancePct < 90 && <span className="text-amber-600 font-medium"> · Academy target: 90%</span>}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick links — mobile access for Training & Nutrition (not in bottom nav) */}
      <div className="md:hidden">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-0.5">More</p>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/training" className="flex flex-col items-center gap-1.5 rounded-2xl border bg-white p-3 text-center hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <Dumbbell size={20} className="text-tranmere-blue" />
            <span className="text-[11px] font-medium">Training</span>
          </Link>
          <Link href="/nutrition" className="flex flex-col items-center gap-1.5 rounded-2xl border bg-white p-3 text-center hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <Apple size={20} className="text-green-600" />
            <span className="text-[11px] font-medium">Nutrition</span>
          </Link>
          <Link href="/gps" className="flex flex-col items-center gap-1.5 rounded-2xl border bg-white p-3 text-center hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <Activity size={20} className="text-orange-500" />
            <span className="text-[11px] font-medium">My GPS</span>
          </Link>
        </div>
      </div>

      <PushOptIn />
    </div>
  )
}
