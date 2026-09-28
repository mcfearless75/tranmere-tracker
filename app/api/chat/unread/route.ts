import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUnreadSummary } from '@/lib/chat/unread'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The signed-in user's unread chat count plus their newest unread message,
 * for the app-wide banner and nav badge. `?viewing=<roomId>` leaves out the
 * room on screen: its markRead may not have landed yet.
 */
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 })

  const viewing = new URL(request.url).searchParams.get('viewing')
  try {
    const summary = await getUnreadSummary(createAdminClient(), user.id, viewing && UUID.test(viewing) ? viewing : null)
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('chat unread lookup failed:', err)
    return NextResponse.json({ ok: false, error: 'Could not load unread messages' }, { status: 500 })
  }
}
