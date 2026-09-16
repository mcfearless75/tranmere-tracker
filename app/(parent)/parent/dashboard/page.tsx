import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { GraduationCap, Megaphone, AlertTriangle } from 'lucide-react'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'
import { londonDateISO } from '@/lib/dates'
import { PushOptIn } from '@/components/PushOptIn'
import { formatEventTime } from '@/lib/calendar/calendarUtils'
import type { PhaseWindows } from '@/lib/attendance/phase'
import { buildStudentDayStatus, isExpectedToday, type Phase } from '@/lib/attendance/dayStatus'
import { buildParentTimeline, type ParentTimelineRow } from '@/lib/attendance/parentNotifyUtils'
import { toAnnouncements, type RawBroadcastMessage, type Announcement } from '@/components/parent/announcementUtils'

export const dynamic = 'force-dynamic'

interface SessionRow { id: string; session_label: string; session_type: string; opens_at: string; closes_at: string }
interface MatchSquadRow {
  status: string
  coach_rating: number | null
  match_events: { opponent: string; match_date: string; location: string; kick_off_time: string | null } | null
}
interface ProfileRow {
  name: string | null
  avatar_url: string | null
  position: string | null
}

interface StudentData {
  id: string
  profile: ProfileRow | null
  todaySessions: SessionRow[] | null
  attendancePct: number | null
  presentCount: number
  scheduledCount: number
  nextMatch: MatchSquadRow | null
  timeline: ParentTimelineRow[]
  coachNote: string | null
}

function AttendanceBar({ pct }: { pct: number | null }) {
  if (pct === null) return <p className="text-xs text-gray-400">No sessions recorded yet</p>
  const colour = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-500'
  const label = pct >= 90 ? 'text-green-700' : pct >= 75 ? 'text-amber-700' : 'text-red-700'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Attendance (last 30 days)</span>
        <span className={`font-semibold ${label}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TodayTimeline({ student, isWeekday }: { student: StudentData; isWeekday: boolean }) {
  const { nextMatch, coachNote } = student

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Today</p>
      {!isWeekday ? (
        <p className="text-sm text-gray-400">No academy check-in today.</p>
      ) : (
        <ul className="space-y-1.5">
          {student.timeline.map(row => (
            <li key={row.phase} className="flex items-start gap-3 text-sm">
              <span className="text-xs font-mono text-gray-400 w-11 shrink-0 pt-0.5">{row.time ?? '—'}</span>
              <span className="flex-1">
                <span className="text-gray-700">{row.text}</span>
                {row.flagged && <span className="block text-xs text-amber-600 flex items-center gap-1 mt-0.5"><AlertTriangle size={11} /> Location flagged</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {nextMatch?.match_events && (
        <p className="text-xs text-gray-500 mt-2">
          Next: vs {nextMatch.match_events.opponent} · {new Date(nextMatch.match_events.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          {nextMatch.match_events.kick_off_time && ` · ${formatEventTime(nextMatch.match_events.kick_off_time)}`}
          {nextMatch.status && ` · ${nextMatch.status}`}
        </p>
      )}

      {coachNote && (
        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mt-2">{coachNote}</p>
      )}
    </div>
  )
}

function StudentOverviewCard({ student, isWeekday }: { student: StudentData; isWeekday: boolean }) {
  const { profile, todaySessions, attendancePct, presentCount, scheduledCount, nextMatch } = student
  const name = profile?.name ?? 'Unknown Student'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="bg-white border rounded-xl p-5 space-y-5">
      {/* Student header */}
      <div className="flex items-center gap-3">
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt={name} className="w-12 h-12 rounded-full object-cover ring-2 ring-tranmere-blue/20" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-tranmere-blue flex items-center justify-center text-white text-sm font-bold">
            {initials}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900">{name}</p>
          {profile?.position && <p className="text-xs text-gray-500">{profile.position}</p>}
        </div>
      </div>

      {/* Today's check-in timeline — above the 30-day bar */}
      <TodayTimeline student={student} isWeekday={isWeekday} />

      {/* Attendance bar */}
      <div>
        <AttendanceBar pct={attendancePct} />
        <p className="text-xs text-gray-400 mt-1">{presentCount} of {scheduledCount} sessions attended</p>
      </div>

      {/* Today's sessions */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Today&apos;s Sessions</p>
        {todaySessions && todaySessions.length > 0 ? (
          <ul className="space-y-1">
            {todaySessions.map(s => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{s.session_label}</span>
                <span className="text-xs text-gray-400 capitalize">{s.session_type}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No sessions scheduled today</p>
        )}
      </div>

      {/* Coursework on Moodle */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coursework</p>
        <a
          href={MOODLE_STUDENT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg border border-tranmere-blue/20 bg-tranmere-blue/5 px-4 py-3 transition-colors hover:bg-tranmere-blue/10"
        >
          <span className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-tranmere-blue" />
            <span>
              <span className="block text-sm font-medium text-gray-900">Go to Moodle</span>
              <span className="block text-xs text-gray-500">Assignments, deadlines and coursework</span>
            </span>
          </span>
          <span className="text-xs font-medium text-tranmere-blue">Open &rarr;</span>
        </a>
      </div>

      {/* Next match */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Next Match</p>
        {nextMatch?.match_events ? (
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-gray-700 font-medium">vs {nextMatch.match_events.opponent}</p>
              <p className="text-xs text-gray-400">{nextMatch.match_events.location} &mdash; {new Date(nextMatch.match_events.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{nextMatch.match_events.kick_off_time && ` · ${formatEventTime(nextMatch.match_events.kick_off_time)}`}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
              nextMatch.status === 'playing' ? 'bg-green-100 text-green-700' :
              nextMatch.status === 'bench' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {nextMatch.status ?? 'TBC'}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No upcoming matches</p>
        )}
      </div>
    </div>
  )
}

export default async function ParentDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: links } = await admin
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', user.id)

  const studentIds = (links ?? []).map(l => l.student_id as string)

  if (studentIds.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No students linked to your account yet.</p>
        <p className="text-sm text-gray-400 mt-1">Contact the academy to link your child&apos;s account.</p>
      </div>
    )
  }

  const now = new Date()
  const today = londonDateISO(now)
  const ago30 = londonDateISO(new Date(Date.now() - 30 * 86400000))
  const isWeekday = isExpectedToday(now)

  const [{ data: settings }, { data: broadcastRooms }] = await Promise.all([
    admin
      .from('academy_settings')
      .select('am_window_start, am_window_end, lunch_window_start, lunch_window_end, pm_window_start, pm_window_end')
      .eq('id', 1)
      .maybeSingle(),
    admin.from('chat_rooms').select('id, name').eq('kind', 'broadcast').order('created_at', { ascending: false }).limit(25),
  ])
  const windows: PhaseWindows = {
    am:    { start: settings?.am_window_start    ?? '07:30', end: settings?.am_window_end    ?? '10:30' },
    lunch: { start: settings?.lunch_window_start ?? '11:00', end: settings?.lunch_window_end ?? '14:30' },
    pm:    { start: settings?.pm_window_start    ?? '14:30', end: settings?.pm_window_end    ?? '17:30' },
  }

  // Latest academy announcement — one row, not a feed (the full feed lives at
  // /parent/announcements). Same source as that page: broadcast chat rooms.
  const roomNameById = new Map((broadcastRooms ?? []).map(r => [r.id as string, (r.name as string | null) ?? null]))
  const roomIds = Array.from(roomNameById.keys())
  let latestAnnouncement: Announcement | null = null
  if (roomIds.length > 0) {
    const { data: rawMessages } = await admin
      .from('chat_messages')
      .select('id, body, created_at, room_id, users(name)')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(10)
    const rawRows: RawBroadcastMessage[] = (rawMessages ?? []).map(m => {
      const sender = Array.isArray(m.users) ? (m.users[0] as { name: string | null } | undefined) : (m.users as { name: string | null } | null)
      return {
        id: m.id as string,
        content: m.body as string | null,
        created_at: m.created_at as string,
        room_name: roomNameById.get(m.room_id as string) ?? null,
        sender_name: sender?.name ?? null,
      }
    })
    latestAnnouncement = toAnnouncements(rawRows)[0] ?? null
  }

  const studentsData: StudentData[] = await Promise.all(studentIds.map(async (sid) => {
    const [
      { data: profile },
      { data: todaySessions },
      { data: attendedDays },
      { data: scheduledDays },
      { data: squadRows },
      { data: todayDaily },
      { data: todayExcusal },
    ] = await Promise.all([
      admin.from('users').select('name, avatar_url, position').eq('id', sid).single(),
      admin.from('attendance_sessions').select('id, session_label, session_type, opens_at, closes_at').eq('scheduled_date', today).order('opens_at'),
      admin.from('daily_attendance').select('attendance_date').eq('student_id', sid).gte('attendance_date', ago30).lte('attendance_date', today),
      admin.from('attendance_sessions').select('scheduled_date').gte('scheduled_date', ago30).lte('scheduled_date', today),
      admin.from('match_squads').select('status, coach_rating, coach_notes, match_events(opponent, match_date, location, kick_off_time)').eq('player_id', sid).gte('match_events.match_date', today).not('match_events', 'is', null).limit(10),
      admin.from('daily_attendance').select('am_checked_at, lunch_checked_at, pm_checked_at, am_is_flagged, lunch_is_flagged, pm_is_flagged').eq('student_id', sid).eq('attendance_date', today).maybeSingle(),
      admin.from('attendance_excusals').select('phases').eq('student_id', sid).eq('excused_date', today).maybeSingle(),
    ])

    // Next match — soonest upcoming fixture (match_date >= today), same pattern
    // as parent/matches. Ordering by created_at showed retro-logged past matches.
    const rows = (squadRows ?? []) as unknown as (MatchSquadRow & { coach_notes: string | null })[]
    const nextMatch = rows
      .filter(r => r.match_events && r.match_events.match_date >= today)
      .sort((a, b) => (a.match_events!.match_date > b.match_events!.match_date ? 1 : -1))[0] ?? null
    // Coach note — only when there's already one on today's own match_squads row (no new notes product).
    const todayMatchRow = rows.find(r => r.match_events?.match_date === today)
    const coachNote = todayMatchRow?.coach_notes?.trim() || null

    const status = buildStudentDayStatus(
      sid,
      {
        am:    { checkedAt: todayDaily?.am_checked_at    ?? null, isFlagged: todayDaily?.am_is_flagged    ?? false, flagReason: null },
        lunch: { checkedAt: todayDaily?.lunch_checked_at ?? null, isFlagged: todayDaily?.lunch_is_flagged ?? false, flagReason: null },
        pm:    { checkedAt: todayDaily?.pm_checked_at    ?? null, isFlagged: todayDaily?.pm_is_flagged    ?? false, flagReason: null },
      },
      windows,
      now,
      (todayExcusal?.phases ?? []) as Phase[],
    )

    const presentDates = new Set((attendedDays ?? []).map(r => r.attendance_date as string))
    const scheduledDates = new Set((scheduledDays ?? []).map(r => r.scheduled_date as string))
    // Only count present days that were actually scheduled, so the % caps at 100
    const presentScheduled = [...presentDates].filter(d => scheduledDates.has(d)).length
    const attendancePct = scheduledDates.size > 0 ? Math.round(presentScheduled / scheduledDates.size * 100) : null

    return {
      id: sid,
      timeline: buildParentTimeline(profile?.name ?? 'Your child', {
        am: status.phases.am,
        lunch: status.phases.lunch,
        pm: status.phases.pm,
      }),
      coachNote,
      profile: profile as ProfileRow | null,
      todaySessions: todaySessions as SessionRow[] | null,
      attendancePct,
      presentCount: presentDates.size,
      scheduledCount: scheduledDates.size,
      nextMatch,
    }
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-tranmere-blue">Overview</h1>

      {latestAnnouncement && (
        <div className="flex items-start gap-2.5 bg-white border rounded-xl p-4">
          <Megaphone size={16} className="text-tranmere-blue shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">
            <span className="font-semibold">{latestAnnouncement.title}:</span> {latestAnnouncement.body}
          </p>
        </div>
      )}

      {studentsData.map(student => (
        <StudentOverviewCard key={student.id} student={student} isWeekday={isWeekday} />
      ))}
      <PushOptIn />
    </div>
  )
}
