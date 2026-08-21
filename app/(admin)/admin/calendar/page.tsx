import { createAdminClient } from '@/lib/supabase/admin'
import { CalendarEventsManager } from './CalendarEventsManager'
import { londonDateISO } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function AdminCalendarPage() {
  const supabase = createAdminClient()
  const today = londonDateISO()

  const { data: events } = await supabase
    .from('calendar_events')
    .select('id, title, event_date, event_time, description')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: true })

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Calendar</h1>
        <p className="text-xs text-muted-foreground">
          Add events for every player, parent and staff member to see
        </p>
      </div>
      <CalendarEventsManager events={events ?? []} />
    </div>
  )
}
