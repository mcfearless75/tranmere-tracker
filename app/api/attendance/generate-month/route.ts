import { requireStaff } from '@/lib/auth/requireRole'
import { londonWallTimeToUTC } from '@/lib/dates'
import { NextResponse } from 'next/server'

function makePin(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase().replace(/[0OIl1]/g, 'X')
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export async function POST(request: Request) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin: adminClient } = auth.ctx

  const { templateId, year, month } = await request.json() as {
    templateId: string
    year: number
    month: number
  }

  const { data: slots, error: slotsError } = await adminClient
    .from('schedule_slots')
    .select('*')
    .eq('template_id', templateId)

  if (slotsError) {
    return NextResponse.json({ error: slotsError.message, created: 0, failed: 0 }, { status: 500 })
  }
  if (!slots?.length) return NextResponse.json({ created: 0, failed: 0 })

  const byDay: Record<number, typeof slots> = {}
  for (const slot of slots) {
    if (!byDay[slot.day_of_week]) byDay[slot.day_of_week] = []
    byDay[slot.day_of_week].push(slot)
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const toCreate = []

  for (let day = 1; day <= daysInMonth; day++) {
    // Build the London calendar date directly — no Date round-trip, so the
    // date can never shift across a timezone boundary.
    const dateISO = `${year}-${pad2(month)}-${pad2(day)}`
    const dow = new Date(dateISO + 'T12:00:00Z').getUTCDay()
    const daySlots = byDay[dow]
    if (!daySlots) continue

    for (const slot of daySlots) {
      // Slot times are London wall-clock. The old new Date(y, m, d, h, mm)
      // ran in server-local time (UTC on Vercel), so a 09:00 slot displayed
      // as 10:00 during BST. Convert with the correct BST/GMT offset.
      const opensAt  = londonWallTimeToUTC(dateISO, slot.start_time.substring(0, 5))
      const closesAt = londonWallTimeToUTC(dateISO, slot.end_time.substring(0, 5))
      const pin      = makePin()

      toCreate.push({
        created_by:    user.id,
        // Real schedule vocabulary (btec/gcse/lessons/gym/tutorial/analysis/…)
        // — the attendance_sessions CHECK constraint was widened to match
        // (migration 040), so pass the type straight through.
        session_type:  slot.session_type,
        session_label: slot.session_label,
        pin_code:      pin,
        // PIN already expired so students cannot check in until coach rotates it
        pin_expires_at: new Date(opensAt.getTime() - 1).toISOString(),
        opens_at:      opensAt.toISOString(),
        closes_at:     closesAt.toISOString(),
        scheduled_date: dateISO,
      })
    }
  }

  let created = 0
  let failed = 0
  let firstError: string | null = null

  for (let i = 0; i < toCreate.length; i += 50) {
    const batch = toCreate.slice(i, i + 50)
    const { data, error } = await adminClient
      .from('attendance_sessions')
      .insert(batch)
      .select('id')

    if (error) {
      // Surface the Postgres message instead of silently discarding it —
      // this is how 51 slots produced 0 sessions with a "success" response.
      failed += batch.length
      if (!firstError) firstError = error.message
    } else {
      created += data?.length ?? 0
    }
  }

  if (failed > 0) {
    return NextResponse.json(
      { error: firstError, created, failed },
      { status: 500 },
    )
  }

  return NextResponse.json({ created, failed: 0 })
}
