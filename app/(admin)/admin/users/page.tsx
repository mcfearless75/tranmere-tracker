import { createAdminClient } from '@/lib/supabase/admin'
import { CreateUserForm } from './CreateUserForm'
import { UsersList } from './UsersList'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const supabase = createAdminClient()

  const [{ data: allUsers }, { data: courses }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, role, course_id, created_at, is_active, year_group, courses(name)')
      .order('created_at', { ascending: false }),
    supabase.from('courses').select('id, name').order('name'),
  ])

  // Soft-hidden accounts (see 053_users_is_active.sql) stay out of the
  // default list — not deleted, just not part of the active roster.
  const users = allUsers?.filter(u => u.is_active !== false)
  const hiddenCount = (allUsers?.length ?? 0) - (users?.length ?? 0)

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">
          {users?.length ?? 0} total
          {hiddenCount > 0 && ` (+${hiddenCount} hidden)`}
        </p>
      </div>

      <CreateUserForm courses={courses ?? []} />

      {/* Search and both layouts live in UsersList — filtering is client-side
          because every active user is already fetched above to render the
          list, so there is nothing to gain from a round trip. */}
      <UsersList users={(users ?? []) as any} courses={courses ?? []} />
    </div>
  )
}
