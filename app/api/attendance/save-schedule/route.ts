import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { templateId, slots } = await request.json() as {
    templateId: string | null
    slots: Record<string, { type: string; label: string; startTime: string; endTime: string }[]>
  }
  const adminClient = createAdminClient()

  let actualTemplateId = templateId

  if (!actualTemplateId) {
    const { data: tmpl } = await adminClient
      .from('schedule_templates')
      .insert({ name: 'Weekly Schedule', created_by: user.id })
      .select('id')
      .single()
    actualTemplateId = tmpl?.id ?? null
  }

  if (!actualTemplateId) return NextResponse.json({ error: 'Could not create template' }, { status: 500 })

  await adminClient.from('schedule_slots').delete().eq('template_id', actualTemplateId)

  const toInsert = Object.entries(slots).flatMap(([day, daySlots]) =>
    daySlots.map((s, idx) => ({
      template_id:   actualTemplateId as string,
      day_of_week:   parseInt(day),
      slot_order:    idx + 1,
      start_time:    s.startTime,
      end_time:      s.endTime,
      session_type:  s.type,
      session_label: s.label,
    }))
  )

  if (toInsert.length > 0) {
    await adminClient.from('schedule_slots').insert(toInsert)
  }

  return NextResponse.json({ templateId: actualTemplateId })
}
