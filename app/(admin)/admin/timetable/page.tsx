import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { TimetableManager } from './TimetableManager'
import { VALID_TIMETABLE_YEAR_GROUPS, YEAR_GROUP_LABELS } from '@/lib/timetable/timetableUtils'

export const dynamic = 'force-dynamic'

export default async function AdminTimetablePage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  const requestedYear = Number(searchParams.year)
  const yearGroup = VALID_TIMETABLE_YEAR_GROUPS.includes(requestedYear) ? requestedYear : 1

  const supabase = createAdminClient()

  const { data: slots } = await supabase
    .from('timetable_slots')
    .select('id, title, day_of_week, start_time, end_time, location, tutor, year_group')
    .eq('year_group', yearGroup)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Timetable</h1>
        <p className="text-xs text-muted-foreground">
          Weekly sessions by year group. Wednesdays have none — that&apos;s match day.
        </p>
      </div>

      <div className="flex gap-2">
        {VALID_TIMETABLE_YEAR_GROUPS.map(year => (
          <Link
            key={year}
            href={`/admin/timetable?year=${year}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              year === yearGroup
                ? 'bg-tranmere-blue text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {YEAR_GROUP_LABELS[year] ?? `Year ${year}`}
          </Link>
        ))}
      </div>

      <TimetableManager slots={slots ?? []} yearGroup={yearGroup} />
    </div>
  )
}
