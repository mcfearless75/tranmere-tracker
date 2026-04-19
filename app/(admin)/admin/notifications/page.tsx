import { createAdminClient } from '@/lib/supabase/admin'
import { NotificationsClient } from './NotificationsClient'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = createAdminClient()

  const [{ data: users }, { data: courses }, { data: subs }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, role, course_id, avatar_url')
      .order('name'),
    supabase.from('courses').select('id, name').order('name'),
    supabase.from('push_subscriptions').select('user_id'),
  ])

  const subscribedIds = new Set((subs ?? []).map(s => s.user_id))
  const enrichedUsers = (users ?? []).map(u => ({
    ...u,
    subscribed: subscribedIds.has(u.id),
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-tranmere-blue">Push Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send targeted push notifications to individuals, groups, or everyone.
        </p>
      </div>
      <NotificationsClient users={enrichedUsers} courses={courses ?? []} />
    </div>
  )
}
