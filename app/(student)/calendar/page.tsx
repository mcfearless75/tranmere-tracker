import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { getCalendarEvents } from '@/lib/calendar/calendarUtils'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-based

  // Fetch a 3-month window centred on the current month so nav feels instant
  const windowStart = new Date(year, month - 2, 1).toISOString().split('T')[0]
  const windowEnd   = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const [
    { data: sessions },
    { data: matches },
    { data: assignments },
  ] = await Promise.all([
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
  ])

  const events = getCalendarEvents(
    sessions  ?? [],
    matches   ?? [],
    assignments ?? [],
  )

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Calendar</h1>
        <p className="text-xs text-muted-foreground">Sessions, matches &amp; deadlines</p>
      </div>

      {/* Calendar card */}
      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
        <CalendarGrid
          events={events}
          initialYear={year}
          initialMonth={month}
        />
      </div>

      {/* Colour key summary below the card */}
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key</p>
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-700">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
            <span>Attendance session</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
            <span>Match</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            <span>Assignment deadline</span>
          </div>
        </div>
      </div>
    </div>
  )
}
