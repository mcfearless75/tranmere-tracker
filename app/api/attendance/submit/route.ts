import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Read the real client IP from Vercel/proxy headers
  const forwarded = request.headers.get('x-forwarded-for')
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : null

  const body = await request.json()
  const { session_id, pin, geo_lat, geo_lng, geo_accuracy_m, selfie_path } = body

  if (!session_id || !pin) {
    return NextResponse.json({ error: 'Missing session_id or pin' }, { status: 400 })
  }

  const campusIpPrefix = process.env.CAMPUS_IP_PREFIX ?? null

  const { data, error } = await supabase.rpc('submit_attendance', {
    p_session_id:      session_id,
    p_pin:             pin,
    p_client_ip:       clientIp,
    p_geo_lat:         geo_lat ?? null,
    p_geo_lng:         geo_lng ?? null,
    p_geo_accuracy_m:  geo_accuracy_m ?? null,
    p_selfie_path:     selfie_path ?? null,
    p_campus_ip_prefix: campusIpPrefix,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.ok) return NextResponse.json({ error: data?.error ?? 'Check-in failed' }, { status: 400 })

  return NextResponse.json({ ok: true, label: data.label, flagged: data.flagged })
}
