import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'
import { VALID_TIMETABLE_YEAR_GROUPS } from '@/lib/timetable/timetableUtils'

export const dynamic = 'force-dynamic'

export default async function TimetablePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, year_group')
    .eq('id', user.id)
    .maybeSingle()

  const hasTimetableYearGroup =
    profile?.year_group != null && VALID_TIMETABLE_YEAR_GROUPS.includes(profile.year_group)

  if (profile?.role !== 'student' || !hasTimetableYearGroup) {
    return (
      <div className="space-y-4">
        <div className="py-2">
          <h1 className="text-lg font-bold text-tranmere-blue">Timetable</h1>
        </div>
        <p className="text-sm text-muted-foreground">No timetable published for your year group yet.</p>
      </div>
    )
  }

  const { data: slots } = await supabase
    .from('timetable_slots')
    .select('id, title, day_of_week, start_time, end_time, location, tutor, year_group')
    .eq('year_group', profile.year_group)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Timetable</h1>
        <p className="text-xs text-muted-foreground">Your weekly college sessions</p>
      </div>
      <TimetableGrid slots={slots ?? []} />
    </div>
  )
}
