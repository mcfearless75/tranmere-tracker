import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('role, name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        userName={profile.name ?? 'Admin'}
        avatarUrl={profile.avatar_url ?? null}
        role={profile.role}
      />
      <main className="flex-1 p-6 bg-gray-50 overflow-auto">{children}</main>
    </div>
  )
}
