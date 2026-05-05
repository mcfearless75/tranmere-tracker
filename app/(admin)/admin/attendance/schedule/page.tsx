import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, ArrowLeft } from 'lucide-react'
import { ScheduleBuilder } from './ScheduleBuilder'

export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Load first (or only) template
  const { data: template } = await admin
    .from('schedule_templates')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const templateId = template?.id ?? null
  const initialSlots: Record<string, { type: string; label: string }> = {}

  if (templateId) {
    const { data: slots } = await admin
      .from('schedule_slots')
      .select('*')
      .eq('template_id', templateId)

    for (const s of slots ?? []) {
      initialSlots[`${s.day_of_week}_${s.time_slot}`] = {
        type: s.session_type,
        label: s.session_label,
      }
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarDays size={24} className="text-tranmere-blue shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-tranmere-blue">Weekly Schedule Builder</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Drag session types onto each day AM/PM slot. Save the template, then generate a full month of sessions in one click.
              Coaches activate each session on the day by opening it and rotating the PIN.
            </p>
          </div>
        </div>
        <Link
          href="/admin/attendance"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-tranmere-blue transition-colors shrink-0"
        >
          <ArrowLeft size={14} />
          Attendance
        </Link>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ScheduleBuilder templateId={templateId} initialSlots={initialSlots as any} />
    </div>
  )
}
