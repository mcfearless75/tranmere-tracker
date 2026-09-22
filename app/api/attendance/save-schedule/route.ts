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
      .eq('is_active', true)
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

  // Matches ScheduleBuilder's maxLength — a slot label is a short tag, not
  // a note. Reject the whole save rather than silently truncating one slot.
  const overLongLabel = Object.values(slots).flat().find(s => (s.label ?? '').length > 60)
  if (overLongLabel) {
    return NextResponse.json({ error: 'Session labels must be 60 characters or fewer' }, { status: 400 })
  }

  let actualTemplateId = templateId

  if (!actualTemplateId) {
    const { data: tmpl, error: tmplError } = await adminClient
      .from('schedule_templates')
      .insert({ name: 'Weekly Schedule', created_by: user.id })
      .select('id')
      .single()
    if (tmplError) {
      return NextResponse.json({ error: `Could not create template: ${tmplError.message}` }, { status: 500 })
    }
    actualTemplateId = tmpl?.id ?? null
  }

  if (!actualTemplateId) return NextResponse.json({ error: 'Could not create template' }, { status: 500 })

  const toInsert = Object.entries(slots).flatMap(([day, daySlots]) =>
    daySlots.map((s, idx) => ({
      day_of_week:   parseInt(day),
      slot_order:    idx + 1,
      start_time:    s.startTime,
      end_time:      s.endTime,
      session_type:  s.type,
      session_label: s.label,
    }))
  )

  // Replacing the week used to be a bare delete() followed by a bare insert(),
  // neither checked — so a failed insert wiped the whole schedule and still
  // reported success. The RPC does both in one transaction (migration 083), so
  // a failure here leaves the previous schedule exactly as it was.
  const { error: replaceError } = await adminClient.rpc('replace_schedule_slots', {
    p_template_id: actualTemplateId,
    p_slots: toInsert,
  })

  if (replaceError) {
    return NextResponse.json(
      { error: `Could not save the schedule: ${replaceError.message}` },
      { status: 500 },
    )
  }

  // Fire-and-forget — the response never waits on push delivery
  void notifyStudentsOfScheduleChange(adminClient)

  return NextResponse.json({ templateId: actualTemplateId })
}
