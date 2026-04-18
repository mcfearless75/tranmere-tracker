import { createClient } from '@/lib/supabase/server'
import { CreateUserForm } from './CreateUserForm'

export default async function UsersPage() {
  const supabase = createClient()

  const [{ data: users }, { data: courses }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, role, created_at, courses(name)')
      .order('created_at', { ascending: false }),
    supabase.from('courses').select('id, name').order('name'),
  ])

  const roleColor: Record<string, string> = {
    student: 'bg-blue-100 text-blue-700',
    coach: 'bg-green-100 text-green-700',
    admin: 'bg-purple-100 text-purple-700',
  }

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
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleColor[u.role] ?? ''}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{(u.courses as any)?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
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
