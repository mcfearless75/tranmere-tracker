import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, ArrowLeft } from 'lucide-react'
import { ScheduleBuilder, type ScheduleSlot } from './ScheduleBuilder'

export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: template } = await admin
    .from('schedule_templates')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const templateId = template?.id ?? null

  const initialSlots: ScheduleSlot[] = templateId
    ? ((await admin.from('schedule_slots').select('*').eq('template_id', templateId).order('slot_order')).data ?? [])
    : []

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarDays size={24} className="text-tranmere-blue shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-tranmere-blue">Weekly Schedule Builder</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Build your weekly timetable with exact session times. Save it as a template, then generate a full month of sessions in one click. Coaches activate each session on the day to open the PIN for students.
            </p>
          </div>
        </div>
        <Link href="/admin/attendance" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-tranmere-blue transition-colors shrink-0">
          <ArrowLeft size={14} />
          Attendance
        </Link>
      </div>

      <ScheduleBuilder templateId={templateId} initialSlots={initialSlots} />
    </div>
  )
}
