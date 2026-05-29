import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Tap-to-check-in — no NFC/QR scan required.
 * The server looks up the academy NFC token internally and submits on behalf
 * of the authenticated student. GPS coords are still recorded for audit.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 })

  const { phase, geo_lat, geo_lng, geo_accuracy_m } = await request.json() as {
    phase: 'am' | 'pm'
    geo_lat?: number | null
    geo_lng?: number | null
    geo_accuracy_m?: number | null
  }

  if (phase !== 'am' && phase !== 'pm') {
    return NextResponse.json({ ok: false, error: 'Invalid phase' }, { status: 400 })
  }

  // Fetch the academy NFC token server-side — student never needs to scan it
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('academy_settings')
    .select('nfc_token')
    .eq('id', 1)
    .single()

  if (!settings?.nfc_token) {
    return NextResponse.json({ ok: false, error: 'Academy not configured' }, { status: 500 })
  }

  const xff = request.headers.get('x-forwarded-for')
  const clientIp = xff?.split(',')[0]?.trim() ?? null

  const { data, error } = await supabase.rpc('submit_daily_check_in', {
    p_phase:          phase,
    p_nfc_token:      settings.nfc_token,
    p_geo_lat:        geo_lat ?? null,
    p_geo_lng:        geo_lng ?? null,
    p_geo_accuracy_m: geo_accuracy_m ?? null,
    p_selfie_path:    null,
    p_client_ip:      clientIp,
  })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, id: data })
}
