import { createAdminClient } from '@/lib/supabase/admin'
import { CreateUserForm } from './CreateUserForm'
import { UserRow } from './UserRow'
import { UserCard } from './UserCard'

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

      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Phone: stacked cards. The table below is min-w-[600px] inside a
            horizontal scroller, which pushed the Role/Year/Course controls
            off-screen on a phone — reachable only by scrolling a table
            sideways, which nobody does. Same controls, same actions, both
            layouts (see UserFields). */}
        <div className="sm:hidden">
          {users?.map(u => (
            <UserCard key={u.id} user={u as any} courses={courses ?? []} />
          ))}
          {!users?.length && (
            <p className="px-4 py-6 text-center text-muted-foreground">No users yet.</p>
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Email', 'Role', 'Year', 'Course', 'Joined'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users?.map(u => (
                <UserRow key={u.id} user={u as any} courses={courses ?? []} />
              ))}
              {!users?.length && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
