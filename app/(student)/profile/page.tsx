import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/(auth)/login/actions'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, role, courses(name)')
    .eq('id', user!.id)
    .single()

  const fields = [
    { label: 'Name', value: profile?.name },
    { label: 'Email', value: profile?.email },
    { label: 'Course', value: (profile?.courses as any)?.name ?? 'None assigned' },
    { label: 'Role', value: profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '—' },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Profile</h1>

      <div className="bg-white rounded-xl border divide-y">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center px-4 py-3">
            <span className="text-xs text-muted-foreground font-medium">{label}</span>
            <span className="text-sm font-medium text-right">{value ?? '—'}</span>
          </div>
        ))}
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="w-full py-3 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 active:bg-red-100 transition-colors"
        >
          Sign Out
        </button>
      </form>
    </div>
  )
}
