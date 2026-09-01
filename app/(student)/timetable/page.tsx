import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'

export const dynamic = 'force-dynamic'

export default async function TimetablePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('year_group')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.year_group !== 1) {
    return (
      <div className="space-y-4">
        <div className="py-2">
          <h1 className="text-lg font-bold text-tranmere-blue">Timetable</h1>
        </div>
        <p className="text-sm text-muted-foreground">No timetable published for your year group yet.</p>
      </div>
    )
  }

  const { data: slots } = await admin
    .from('timetable_slots')
    .select('id, title, day_of_week, start_time, end_time, location, tutor, year_group')
    .eq('year_group', 1)
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
