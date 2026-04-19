import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Allow automated cron/edge function calls via shared secret
  const cronSecret = request.headers.get('x-cron-secret')
  const isCronCall = cronSecret && cronSecret === process.env.CRON_SECRET

  const adminClient = createAdminClient()

  if (!isCronCall) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Role check via service client (bypass RLS)
    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { title, body, targetUserIds, url } = await request.json()

  if (!title || !body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  let query = adminClient.from('push_subscriptions').select('endpoint, p256dh, auth')
  if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
    query = query.in('user_id', targetUserIds)
  }

  const { data: subs, error: subError } = await query
  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 })

  const results = await Promise.allSettled(
    (subs ?? []).map(sub =>
      sendPushNotification(sub, { title, body, url: url ?? '/dashboard' })
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ sent, failed, total: subs?.length ?? 0 })
}
