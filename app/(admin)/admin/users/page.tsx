import { createClient as createServiceClient } from '@supabase/supabase-js'
import { CreateUserForm } from './CreateUserForm'
import { UserRow } from './UserRow'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  // Service client bypasses RLS so admins can see all users
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: users }, { data: courses }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, role, course_id, created_at, courses(name)')
      .order('created_at', { ascending: false }),
    supabase.from('courses').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">{users?.length ?? 0} total</p>
      </div>

      <CreateUserForm courses={courses ?? []} />

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Email', 'Role', 'Course', 'Joined'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users?.map(u => (
                <UserRow key={u.id} user={u as any} courses={courses ?? []} />
              ))}
              {!users?.length && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
