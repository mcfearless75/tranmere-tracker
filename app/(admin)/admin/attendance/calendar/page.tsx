import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Helpers
function startOfWeek(d: Date) {
  const r = new Date(d)
  const dow = (r.getDay() + 6) % 7  // Mon = 0, Sun = 6
  r.setDate(r.getDate() - dow)
  r.setHours(0, 0, 0, 0)
  return r
}
function fmtIso(d: Date) { return d.toISOString().split('T')[0] }
function shiftWeek(iso: string, weeks: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + weeks * 7)
  return fmtIso(startOfWeek(d))
}

// Window the calendar shows
const HOUR_START = 8
const HOUR_END   = 18
const ROW_HEIGHT = 36     // px per hour
const TOTAL_HEIGHT = (HOUR_END - HOUR_START) * ROW_HEIGHT

const TYPE_COLOURS: Record<string, string> = {
  training:  'bg-blue-500/85   text-white',
  match:     'bg-green-500/85  text-white',
  classroom: 'bg-purple-500/85 text-white',
}

export default async function AttendanceCalendarPage({
  searchParams,
}: {
  searchParams: { week?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const today = new Date()
  const weekStartIso = searchParams.week ?? fmtIso(startOfWeek(today))
  const weekStart = new Date(weekStartIso + 'T12:00:00')
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 4)  // Mon..Fri
  const weekEndIso = fmtIso(weekEnd)

  const days: { iso: string; date: Date; label: string }[] = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i)
    days.push({
      iso: fmtIso(d),
      date: d,
      label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    })
  }

  // Fetch all sessions for the week + any match_events on those dates
  const [{ data: sessions }, { data: matchEvents }] = await Promise.all([
    admin
      .from('attendance_sessions')
      .select('id, session_label, session_type, opens_at, closes_at, scheduled_date')
      .gte('scheduled_date', weekStartIso)
      .lte('scheduled_date', weekEndIso)
      .order('opens_at'),
    admin
      .from('match_events')
      .select('id, match_date, opponent, location')
      .gte('match_date', weekStartIso)
      .lte('match_date', weekEndIso),
  ])

  // Build date → match detail lookup so match session blocks reflect live match data
  const matchByDate: Record<string, { id: string; opponent: string | null; location: string | null }> = {}
  for (const m of matchEvents ?? []) {
    const d = (m.match_date as string).split('T')[0]
    matchByDate[d] = { id: m.id as string, opponent: m.opponent as string | null, location: m.location as string | null }
  }

  // Group sessions by day
  const byDay: Record<string, typeof sessions> = {}
  for (const s of sessions ?? []) {
    const d = s.scheduled_date as string
    if (!byDay[d]) byDay[d] = []
    byDay[d]!.push(s)
  }

  function blockStyle(opens_at: string, closes_at: string | null) {
    const o = new Date(opens_at)
    const c = closes_at ? new Date(closes_at) : new Date(o.getTime() + 60 * 60_000)
    const startH = o.getHours() + o.getMinutes() / 60
    const endH   = c.getHours() + c.getMinutes() / 60
    const top    = (startH - HOUR_START) * ROW_HEIGHT
    const height = (endH - startH) * ROW_HEIGHT
    return { top: `${Math.max(0, top)}px`, height: `${Math.max(20, height)}px` }
  }

  const todayIso = fmtIso(today)

  return (
    <div className="space-y-4 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays size={22} className="text-tranmere-blue" />
          <h1 className="text-xl font-bold text-tranmere-blue">Weekly Calendar</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/attendance"
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-tranmere-blue px-2.5 py-1.5 rounded-lg hover:bg-tranmere-blue/5"
          >
            <ListChecks size={13} /> Roster view
          </Link>
          <Link
            href="/admin/attendance/schedule"
            className="text-xs font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-3 py-1.5 rounded-lg"
          >
            Edit schedule
          </Link>
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between bg-white border rounded-xl px-3 py-2">
        <Link href={`/admin/attendance/calendar?week=${shiftWeek(weekStartIso, -1)}`} className="p-2 rounded-lg hover:bg-gray-100 text-muted-foreground" aria-label="Previous week">
          <ChevronLeft size={18} />
        </Link>
        <div className="text-center">
          <p className="text-sm font-bold text-tranmere-blue">
            Week of {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {weekStartIso !== fmtIso(startOfWeek(today)) && (
            <Link href="/admin/attendance/calendar" className="text-[11px] text-tranmere-blue underline">Jump to this week</Link>
          )}
        </div>
        <Link href={`/admin/attendance/calendar?week=${shiftWeek(weekStartIso, 1)}`} className="p-2 rounded-lg hover:bg-gray-100 text-muted-foreground" aria-label="Next week">
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border rounded-xl overflow-x-auto">
        <div className="grid grid-cols-[60px_repeat(5,minmax(140px,1fr))] min-w-[760px]">

          {/* Header row */}
          <div className="border-b bg-gray-50/60" />
          {days.map(d => (
            <div key={d.iso} className={`border-b border-l p-2 text-center ${d.iso === todayIso ? 'bg-tranmere-blue/5' : 'bg-gray-50/60'}`}>
              <p className={`text-[11px] uppercase font-bold tracking-wider ${d.iso === todayIso ? 'text-tranmere-blue' : 'text-muted-foreground'}`}>
                {d.label.split(' ')[0]}
              </p>
              <p className={`text-sm font-bold ${d.iso === todayIso ? 'text-tranmere-blue' : ''}`}>
                {d.date.getDate()} {d.date.toLocaleDateString('en-GB', { month: 'short' })}
              </p>
            </div>
          ))}

          {/* Time gutter + day columns */}
          <div className="relative" style={{ height: TOTAL_HEIGHT }}>
            {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, i) => {
              const h = HOUR_START + i
              return (
                <div
                  key={h}
                  className="absolute right-1 text-[10px] font-mono text-muted-foreground"
                  style={{ top: `${i * ROW_HEIGHT - 6}px` }}
                >
                  {h.toString().padStart(2, '0')}:00
                </div>
              )
            })}
          </div>

          {days.map(d => {
            const sessionsThisDay = byDay[d.iso] ?? []
            return (
              <div
                key={d.iso}
                className={`relative border-l ${d.iso === todayIso ? 'bg-tranmere-blue/[0.03]' : ''}`}
                style={{ height: TOTAL_HEIGHT }}
              >
                {/* hour rules */}
                {Array.from({ length: HOUR_END - HOUR_START }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-dashed border-gray-100"
                    style={{ top: `${i * ROW_HEIGHT}px` }}
                  />
                ))}

                {/* session blocks */}
                {sessionsThisDay.map(s => {
                  const colour = TYPE_COLOURS[s.session_type] ?? 'bg-gray-500 text-white'
                  const o = new Date(s.opens_at)
                  const c = s.closes_at ? new Date(s.closes_at) : null
                  const time = `${o.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}${c ? `–${c.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}`
                  const matchDetail = s.session_type === 'match' ? (matchByDate[s.scheduled_date as string] ?? null) : null
                  const blockHref = matchDetail ? `/admin/match-events/${matchDetail.id}` : s.session_type === 'match' ? '/admin/match-events' : null

                  // For match blocks: show live opponent + location from match_events if available
                  const label = matchDetail?.opponent ? `vs ${matchDetail.opponent}` : s.session_label
                  const sublabel = matchDetail?.location ?? time

                  const inner = (
                    <>
                      <p className="font-bold truncate">{label}</p>
                      <p className="text-[10px] opacity-90 truncate">{sublabel}</p>
                      <p className="text-[10px] opacity-75 truncate">KO {time.split('–')[0]}</p>
                      {matchDetail && <ExternalLink size={9} className="absolute top-1 right-1 opacity-70" />}
                    </>
                  )

                  const baseClass = `absolute inset-x-1 rounded-md px-2 py-1 text-[11px] leading-tight shadow-sm overflow-hidden ${colour}`

                  return blockHref ? (
                    <Link
                      key={s.id}
                      href={blockHref}
                      className={`${baseClass} hover:brightness-110 transition-[filter]`}
                      style={blockStyle(s.opens_at, s.closes_at)}
                      title={`${label}${matchDetail?.location ? ` @ ${matchDetail.location}` : ''} — KO ${time.split('–')[0]} · Click to view match`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div
                      key={s.id}
                      className={baseClass}
                      style={blockStyle(s.opens_at, s.closes_at)}
                      title={`${label} — ${time}`}
                    >
                      {inner}
                    </div>
                  )
                })}

                {sessionsThisDay.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground/60">
                    —
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground border-t px-4 py-2.5">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500/85" /> Training</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500/85" /> Classroom</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500/85" /> Match</span>
        </div>
      </div>
    </div>
  )
}
