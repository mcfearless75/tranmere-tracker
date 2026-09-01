import { createAdminClient } from '@/lib/supabase/admin'
import { CalendarEventsManager } from './CalendarEventsManager'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { getCalendarEvents, expandTimetableSlots } from '@/lib/calendar/calendarUtils'
import { londonDateISO } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function AdminCalendarPage() {
  const supabase = createAdminClient()
  const today = londonDateISO()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-based

  // Fetch a 3-month window centred on the current month so grid nav feels instant
  const windowStart = new Date(year, month - 2, 1).toISOString().split('T')[0]
  const windowEnd   = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const [
    { data: upcomingEvents },
    { data: sessions },
    { data: matches },
    { data: assignments },
    { data: windowEvents },
    { data: timetableSlots },
  ] = await Promise.all([
    // Unbounded "manage upcoming events" list for CalendarEventsManager below
    supabase
      .from('calendar_events')
      .select('id, title, event_date, event_time, description')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true, nullsFirst: true }),

    supabase
      .from('attendance_sessions')
      .select('scheduled_date, session_label, session_type, opens_at, closes_at')
      .gte('scheduled_date', windowStart)
      .lte('scheduled_date', windowEnd)
      .order('scheduled_date'),

    supabase
      .from('match_events')
      .select('match_date, opponent, location')
      .gte('match_date', windowStart)
      .lte('match_date', windowEnd)
      .order('match_date'),

    supabase
      .from('assignments')
      .select('due_date, title')
      .gte('due_date', windowStart)
      .lte('due_date', windowEnd)
      .order('due_date'),

    // Window-scoped copy for the grid (separate from the unbounded list above)
    supabase
      .from('calendar_events')
      .select('id, title, event_date, event_time, description')
      .gte('event_date', windowStart)
      .lte('event_date', windowEnd)
      .order('event_date'),

    // All year groups — admins see every class, not just one student's
    supabase
      .from('timetable_slots')
      .select('id, year_group, day_of_week, start_time, end_time, title, location'),
  ])

  const classEvents = expandTimetableSlots(timetableSlots ?? [], windowStart, windowEnd)

  const gridEvents = getCalendarEvents(
    sessions ?? [],
    matches ?? [],
    assignments ?? [],
    windowEvents ?? [],
    classEvents,
  )

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Calendar</h1>
        <p className="text-xs text-muted-foreground">
          Add events for every player, parent and staff member to see
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
        <CalendarGrid events={gridEvents} initialYear={year} initialMonth={month} />
      </div>

      <CalendarEventsManager events={upcomingEvents ?? []} />
    </div>
  )
}
