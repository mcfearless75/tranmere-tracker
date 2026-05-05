import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 })

  const {
    phase,
    nfc_token,
    geo_lat,
    geo_lng,
    geo_accuracy_m,
    selfie_path,
  } = await request.json() as {
    phase: 'am' | 'pm'
    nfc_token: string
    geo_lat?: number | null
    geo_lng?: number | null
    geo_accuracy_m?: number | null
    selfie_path?: string | null
  }

  if (phase !== 'am' && phase !== 'pm') {
    return NextResponse.json({ ok: false, error: 'Invalid phase' }, { status: 400 })
  }
  if (!nfc_token) {
    return NextResponse.json({ ok: false, error: 'Missing check-in token — tap the NFC sticker' }, { status: 400 })
  }

  const xff = request.headers.get('x-forwarded-for')
  const clientIp = xff?.split(',')[0]?.trim() ?? null

  const { data, error } = await supabase.rpc('submit_daily_check_in', {
    p_phase:           phase,
    p_nfc_token:       nfc_token,
    p_geo_lat:         geo_lat ?? null,
    p_geo_lng:         geo_lng ?? null,
    p_geo_accuracy_m:  geo_accuracy_m ?? null,
    p_selfie_path:     selfie_path ?? null,
    p_client_ip:       clientIp,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, id: data })
}
