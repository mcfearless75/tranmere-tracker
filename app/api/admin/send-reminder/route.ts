import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studentId, title, body, url } = await request.json()
  if (!studentId || !title || !body) {
    return NextResponse.json({ error: 'studentId, title and body required' }, { status: 400 })
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', studentId)

  if (!subs || subs.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No push subscription — student needs to enable notifications on their device first.',
    })
  }

  let sent = 0
  let failed = 0
  for (const sub of subs) {
    try {
      await sendPushNotification(sub, { title, body, url: url ?? '/dashboard' })
      sent++
    } catch {
      failed++
    }
  }

  return NextResponse.json({
    success: sent > 0,
    message: `Sent to ${sent} device(s)${failed > 0 ? `, ${failed} failed` : ''}`,
  })
}
