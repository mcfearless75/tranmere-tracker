import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

export const dynamic = 'force-dynamic'

interface SessionRow { id: string; session_label: string; session_type: string; opens_at: string; closes_at: string }
interface MatchSquadRow {
  status: string
  coach_rating: number | null
  match_events: { opponent: string; match_date: string; location: string } | null
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

function StudentOverviewCard({ student }: { student: StudentData }) {
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
              <p className="text-xs text-gray-400">{nextMatch.match_events.location} &mdash; {new Date(nextMatch.match_events.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
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

  const today = new Date().toISOString().split('T')[0]
  const ago30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const studentsData: StudentData[] = await Promise.all(studentIds.map(async (sid) => {
    const [
      { data: profile },
      { data: todaySessions },
      { data: attendedDays },
      { data: scheduledDays },
      { data: nextMatch },
    ] = await Promise.all([
      admin.from('users').select('name, avatar_url, position').eq('id', sid).single(),
      admin.from('attendance_sessions').select('id, session_label, session_type, opens_at, closes_at').eq('scheduled_date', today).order('opens_at'),
      admin.from('daily_attendance').select('attendance_date').eq('student_id', sid).gte('attendance_date', ago30).lte('attendance_date', today),
      admin.from('attendance_sessions').select('scheduled_date').gte('scheduled_date', ago30).lte('scheduled_date', today),
      admin.from('match_squads').select('status, coach_rating, match_events(opponent, match_date, location)').eq('player_id', sid).not('match_events', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const presentDates = new Set((attendedDays ?? []).map(r => r.attendance_date as string))
    const scheduledDates = new Set((scheduledDays ?? []).map(r => r.scheduled_date as string))
    const attendancePct = scheduledDates.size > 0 ? Math.round(presentDates.size / scheduledDates.size * 100) : null

    return {
      id: sid,
      profile: profile as ProfileRow | null,
      todaySessions: todaySessions as SessionRow[] | null,
      attendancePct,
      presentCount: presentDates.size,
      scheduledCount: scheduledDates.size,
      nextMatch: nextMatch as MatchSquadRow | null,
    }
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-tranmere-blue">Overview</h1>
      {studentsData.map(student => (
        <StudentOverviewCard key={student.id} student={student} />
      ))}
    </div>
  )
}
