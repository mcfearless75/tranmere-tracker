import { createAdminClient } from '@/lib/supabase/admin'
import { TimetableManager } from './TimetableManager'

export const dynamic = 'force-dynamic'

export default async function AdminTimetablePage() {
  const supabase = createAdminClient()

  const { data: slots } = await supabase
    .from('timetable_slots')
    .select('id, title, day_of_week, start_time, end_time, location, tutor, year_group')
    .eq('year_group', 1)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">1st-Year Timetable</h1>
        <p className="text-xs text-muted-foreground">
          Weekly sessions for 1st-year students. Wednesdays have none — that&apos;s match day.
        </p>
      </div>
      <TimetableManager slots={slots ?? []} />
    </div>
  )
}
