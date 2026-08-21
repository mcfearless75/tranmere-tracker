import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { getCalendarEvents, type MatchEventRow } from '@/lib/calendar/calendarUtils'

export const dynamic = 'force-dynamic'

interface MatchSquadRow {
  match_events: { match_date: string; opponent: string; location: string | null } | null
}

export default async function ParentCalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: links } = await admin
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', user.id)
  const studentIds = (links ?? []).map(l => l.student_id as string)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-based
  const windowStart = new Date(year, month - 2, 1).toISOString().split('T')[0]
  const windowEnd = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const [{ data: squads }, { data: calendarEvents }] = await Promise.all([
    studentIds.length
      ? admin
          .from('match_squads')
          .select('match_events(match_date, opponent, location)')
          .in('player_id', studentIds)
          .not('match_events', 'is', null)
      : Promise.resolve({ data: [] as MatchSquadRow[] }),
    admin
      .from('calendar_events')
      .select('id, title, event_date, event_time, description')
      .gte('event_date', windowStart)
      .lte('event_date', windowEnd),
  ])

  const matches: MatchEventRow[] = ((squads ?? []) as unknown as MatchSquadRow[])
    .map(s => s.match_events)
    .filter((m): m is { match_date: string; opponent: string; location: string | null } => !!m)
    .filter(m => m.match_date >= windowStart && m.match_date <= windowEnd)

  const events = getCalendarEvents([], matches, [], calendarEvents ?? [])

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Calendar</h1>
        <p className="text-xs text-muted-foreground">Matches &amp; academy events</p>
      </div>
      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
        <CalendarGrid events={events} initialYear={year} initialMonth={month} />
      </div>
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
            <span>Match</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <span>Event</span>
          </div>
        </div>
      </div>
    </div>
  )
}
