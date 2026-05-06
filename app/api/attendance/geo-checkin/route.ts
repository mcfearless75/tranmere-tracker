import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GROUND_LAT  = parseFloat(process.env.NEXT_PUBLIC_GROUND_LAT  ?? '53.3963')
const GROUND_LNG  = parseFloat(process.env.NEXT_PUBLIC_GROUND_LNG  ?? '-3.0942')
const RADIUS_M    = parseInt(process.env.NEXT_PUBLIC_GROUND_RADIUS_M ?? '300', 10)

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json() as { period: string; lat: number; lng: number; accuracy?: number }
  const { period, lat, lng } = body

  if (!period || !['am', 'pm'].includes(period) || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Server-side distance check — client check is UX only, server is authoritative
  const dist = haversineMetres(lat, lng, GROUND_LAT, GROUND_LNG)
  if (dist > RADIUS_M) {
    return NextResponse.json({ error: `Too far from ground (${Math.round(dist)}m)` }, { status: 422 })
  }

  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()
  const admin = createAdminClient()

  const column = period === 'am' ? 'am_checked_at' : 'pm_checked_at'

  // Upsert daily_attendance row — don't overwrite if already checked in
  const { data: existing } = await admin
    .from('daily_attendance')
    .select('id, am_checked_at, pm_checked_at')
    .eq('student_id', user.id)
    .eq('attendance_date', today)
    .maybeSingle()

  if (existing && existing[column as keyof typeof existing]) {
    // Already checked in — return success idempotently
    return NextResponse.json({ ok: true, already: true })
  }

  if (existing) {
    await admin
      .from('daily_attendance')
      .update({ [column]: now })
      .eq('id', existing.id)
  } else {
    await admin
      .from('daily_attendance')
      .insert({ student_id: user.id, attendance_date: today, [column]: now })
  }

  return NextResponse.json({ ok: true })
}
