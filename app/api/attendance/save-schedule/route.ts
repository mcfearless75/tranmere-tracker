import { requireStaff } from '@/lib/auth/requireRole'
import { sendPushNotification } from '@/lib/webpush'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Push a schedule-change notice to every student. Best effort — errors are swallowed. */
async function notifyStudentsOfScheduleChange(adminClient: SupabaseClient): Promise<void> {
  try {
    const { data: students } = await adminClient
      .from('users')
      .select('id')
      .eq('role', 'student')
    if (!students?.length) return

    const { data: subs } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', students.map(s => s.id))
    if (!subs?.length) return

    const payload = {
      title: 'Training schedule updated',
      body: 'The weekly schedule has changed — check your calendar.',
      url: '/calendar',
    }
    await Promise.allSettled(subs.map(sub => sendPushNotification(sub, payload)))
  } catch {
    // Never let notification failures affect the save
  }
}

export async function POST(request: Request) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin: adminClient } = auth.ctx

  const { templateId, slots } = await request.json() as {
    templateId: string | null
    slots: Record<string, { type: string; label: string; startTime: string; endTime: string }[]>
  }

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

  // Fire-and-forget — the response never waits on push delivery
  void notifyStudentsOfScheduleChange(adminClient)

  return NextResponse.json({ templateId: actualTemplateId })
}
