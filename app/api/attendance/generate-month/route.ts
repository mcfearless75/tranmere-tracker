import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

function makePin(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase().replace(/[0OIl1]/g, 'X')
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { templateId, year, month } = await request.json() as {
    templateId: string
    year: number
    month: number
  }
  const adminClient = createAdminClient()

  const { data: slots } = await adminClient
    .from('schedule_slots')
    .select('*')
    .eq('template_id', templateId)

  if (!slots?.length) return NextResponse.json({ created: 0 })

  const byDay: Record<number, typeof slots> = {}
  for (const slot of slots) {
    if (!byDay[slot.day_of_week]) byDay[slot.day_of_week] = []
    byDay[slot.day_of_week].push(slot)
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const toCreate = []

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dow = date.getDay()
    const daySlots = byDay[dow]
    if (!daySlots) continue

    for (const slot of daySlots) {
      const [sh, sm] = slot.start_time.substring(0, 5).split(':').map(Number)
      const [eh, em] = slot.end_time.substring(0, 5).split(':').map(Number)
      const opensAt   = new Date(year, month - 1, day, sh, sm, 0)
      const closesAt  = new Date(year, month - 1, day, eh, em, 0)
      const pin       = makePin()

      toCreate.push({
        created_by:    user.id,
        session_type:  slot.session_type,
        session_label: slot.session_label,
        pin_code:      pin,
        // PIN already expired so students cannot check in until coach rotates it
        pin_expires_at: new Date(opensAt.getTime() - 1).toISOString(),
        opens_at:      opensAt.toISOString(),
        closes_at:     closesAt.toISOString(),
        scheduled_date: date.toISOString().split('T')[0],
      })
    }
  }

  let created = 0
  for (let i = 0; i < toCreate.length; i += 50) {
    const { data } = await adminClient
      .from('attendance_sessions')
      .insert(toCreate.slice(i, i + 50))
      .select('id')
    created += data?.length ?? 0
  }

  return NextResponse.json({ created })
}
