import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { MobileAdminBar } from '@/components/layout/MobileAdminBar'
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

  const userName = profile.name ?? 'Admin'
  const avatarUrl = profile.avatar_url ?? null

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Mobile top bar + drawer */}
      <MobileAdminBar userName={userName} avatarUrl={avatarUrl} role={profile.role} />

      {/* Desktop layout */}
      <div className="md:flex md:min-h-screen">
        <div className="hidden md:block">
          <AdminSidebar userName={userName} avatarUrl={avatarUrl} role={profile.role} />
        </div>
        <main className="flex-1 p-4 md:p-6 max-w-full overflow-x-hidden pb-20 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  )
}
