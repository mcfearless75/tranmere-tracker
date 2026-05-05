import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { NewSessionForm } from './NewSessionForm'
import { ClipboardList, CheckCircle, Clock, Users, CalendarDays, PlayCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

type SessionRow = {
  id: string
  session_label: string
  session_type: string
  pin_code: string
  pin_expires_at: string
  opens_at: string
  closes_at: string | null
  scheduled_date: string | null
  created_at: string
  attendance_records: { count: number }[]
}

export default async function AttendancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  // Pull today + next 7 days + recent past
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const weekAhead = new Date(today); weekAhead.setDate(weekAhead.getDate() + 7)
  const weekAheadStr = weekAhead.toISOString().split('T')[0]
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  const { data: sessions } = await adminClient
    .from('attendance_sessions')
    .select(`
      id, session_label, session_type, pin_code, pin_expires_at,
      opens_at, closes_at, scheduled_date, created_at,
      attendance_records(count)
    `)
    .gte('scheduled_date', weekAgoStr)
    .lte('scheduled_date', weekAheadStr)
    .order('opens_at', { ascending: true })
    .returns<SessionRow[]>()

  const now = new Date()

  const todayLive: SessionRow[]    = []  // today, opens_at <= now <= closes_at
  const todayUpcoming: SessionRow[] = [] // today, opens_at > now
  const upcoming: SessionRow[]      = [] // future days
  const past: SessionRow[]          = [] // already closed

  for (const s of sessions ?? []) {
    const opens  = new Date(s.opens_at)
    const closes = s.closes_at ? new Date(s.closes_at) : null
    const isToday = s.scheduled_date === todayStr

    if (closes && closes <= now) {
      past.push(s)
    } else if (isToday && opens <= now) {
      todayLive.push(s)
    } else if (isToday) {
      todayUpcoming.push(s)
    } else if (opens > now) {
      upcoming.push(s)
    } else {
      past.push(s)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={22} className="text-tranmere-blue" />
          <h1 className="text-xl font-bold text-tranmere-blue">Attendance</h1>
        </div>
        <Link
          href="/admin/attendance/schedule"
          className="flex items-center gap-1.5 text-sm font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <CalendarDays size={15} />
          Weekly Schedule
        </Link>
      </div>

      <NewSessionForm coachId={user.id} />

      {todayLive.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Live Now
          </h2>
          {todayLive.map(s => <SessionCard key={s.id} s={s} state="live" />)}
        </section>
      )}

      {todayUpcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <PlayCircle size={13} />
            Today — Upcoming
          </h2>
          {todayUpcoming.map(s => <SessionCard key={s.id} s={s} state="today" />)}
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            This Week
          </h2>
          {upcoming.slice(0, 12).map(s => <SessionCard key={s.id} s={s} state="upcoming" />)}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Past Sessions
          </h2>
          {past.slice(-10).reverse().map(s => <SessionCard key={s.id} s={s} state="past" />)}
        </section>
      )}

      {!sessions?.length && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No sessions yet — generate them from <Link href="/admin/attendance/schedule" className="underline text-tranmere-blue">Weekly Schedule</Link>.
        </p>
      )}
    </div>
  )
}

function SessionCard({ s, state }: { s: SessionRow; state: 'live' | 'today' | 'upcoming' | 'past' }) {
  const count   = s.attendance_records?.[0]?.count ?? 0
  const opens   = new Date(s.opens_at)
  const closes  = s.closes_at ? new Date(s.closes_at) : null
  const timeStr = opens.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                + (closes ? `–${closes.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '')

  const dayStr = s.scheduled_date
    ? new Date(s.scheduled_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : opens.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  const icon =
    state === 'live'     ? <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" /> :
    state === 'today'    ? <Clock size={16} className="text-tranmere-blue shrink-0" /> :
    state === 'upcoming' ? <Clock size={16} className="text-muted-foreground shrink-0" /> :
                           <CheckCircle size={16} className="text-muted-foreground shrink-0" />

  return (
    <Link
      href={`/admin/attendance/${s.id}`}
      className="flex items-center justify-between bg-white border rounded-xl px-4 py-3 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="font-semibold text-sm">{s.session_label}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {s.session_type} · {dayStr} · {timeStr}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Users size={14} />
        <span className="font-medium text-tranmere-blue">{count}</span>
      </div>
    </Link>
  )
}
