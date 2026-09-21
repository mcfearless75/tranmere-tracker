import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotificationToUser } from '@/lib/webpush'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'coach', 'teacher']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function requireStaff() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) return null
  return user.id
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { trialId: string } },
) {
  const actorId = await requireStaff()
  if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trialId = params.trialId
  if (!UUID_PATTERN.test(trialId)) {
    return NextResponse.json({ error: 'Invalid trial id' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { staff_ids: staffIdsRaw, notify } = (body ?? {}) as Record<string, unknown>
  const staffIds = Array.isArray(staffIdsRaw)
    ? [...new Set(staffIdsRaw.filter((id): id is string => typeof id === 'string' && UUID_PATTERN.test(id)))]
    : []

  const admin = createAdminClient()
  const { data: event } = await admin.from('trial_events').select('id, title, event_date, location').eq('id', trialId).maybeSingle()
  if (!event) return NextResponse.json({ error: 'Trial not found' }, { status: 404 })

  const { data: validStaff } = staffIds.length
    ? await admin.from('users').select('id').in('id', staffIds).in('role', STAFF_ROLES).eq('is_active', true)
    : { data: [] as { id: string }[] }

  const nextIds = (validStaff ?? []).map(s => s.id)

  const { error: delErr } = await admin.from('trial_event_staff').delete().eq('trial_event_id', trialId)
  if (delErr) {
    return NextResponse.json({
      error: delErr.message.includes('schema cache') || delErr.message.includes('does not exist')
        ? 'Run supabase/migrations/080_trial_event_staff.sql in the Supabase SQL editor first.'
        : delErr.message,
    }, { status: 500 })
  }

  if (nextIds.length) {
    const { error: insErr } = await admin.from('trial_event_staff').insert(
      nextIds.map(user_id => ({ trial_event_id: trialId, user_id })),
    )
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  if (notify === true && nextIds.length) {
    const where = [event.event_date, event.location].filter(Boolean).join(' · ')
    await Promise.allSettled(
      nextIds.map(id =>
        sendPushNotificationToUser(
          admin,
          id,
          'Trial event',
          `${event.title} — ${where}`,
          `/admin/recruitment/trials/${trialId}`,
        ),
      ),
    )
  }

  return NextResponse.json({ ok: true, staff_count: nextIds.length })
}
