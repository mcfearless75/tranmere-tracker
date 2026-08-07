import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { endpoint, keys } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  // Shared-device hygiene: a browser endpoint identifies the DEVICE, not the
  // user. When a different account logs in on the same device, remove any
  // previous user's row for this endpoint so their notifications stop arriving
  // here. RLS ("push_own") blocks the user client from touching other users'
  // rows, so this cleanup must use the service-role client.
  const admin = createAdminClient()
  const { error: cleanupError } = await admin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .neq('user_id', user.id)

  if (cleanupError) {
    return NextResponse.json({ error: cleanupError.message }, { status: 500 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: 'user_id,endpoint' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
