import { SideNav } from '@/components/layout/SideNav'
import { BottomNav } from '@/components/layout/BottomNav'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { MobileAdminBar } from '@/components/layout/MobileAdminBar'
import { ParentSidebar } from '@/components/layout/ParentSidebar'
import { MobileParentBar } from '@/components/layout/MobileParentBar'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

const STAFF_ROLES = ['admin', 'coach', 'teacher']

export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // .maybeSingle(): a genuinely-missing profile row must not crash the
  // layout — .single() throwing here is what a layout-level crash (which
  // no nested error.tsx can catch, only the root boundary) looks like.
  const { data: profile } = await admin
    .from('users')
    .select('name, avatar_url, role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role ?? 'student'
  const isStaff = STAFF_ROLES.includes(role)
  const isParent = role === 'parent'
  const name = profile?.name ?? 'User'
  const avatar = profile?.avatar_url ?? null

  return (
    // Single wrapper — children rendered ONCE, CSS handles desktop vs mobile layout.
    // Unlike app/chat/layout.tsx (staff vs. everyone-else only), this route is
    // reachable by parents too — via the "Documents" nav entry now present in
    // ParentSidebar/MobileParentBar — so it needs a genuine three-way branch.
    <div className="md:flex md:h-screen md:overflow-hidden bg-gray-50">
      <div className="hidden md:block shrink-0">
        {isStaff ? (
          <AdminSidebar userName={name} avatarUrl={avatar} role={role} />
        ) : isParent ? (
          <ParentSidebar userName={name} avatarUrl={avatar} />
        ) : (
          <SideNav userName={name} avatarUrl={avatar} role={role} />
        )}
      </div>

      <main className="flex-1 flex flex-col overflow-x-hidden md:overflow-hidden min-h-[100dvh] md:min-h-0">
        {children}
      </main>

      {isStaff ? (
        <MobileAdminBar userName={name} avatarUrl={avatar} role={role} />
      ) : isParent ? (
        <MobileParentBar />
      ) : (
        <BottomNav />
      )}
    </div>
  )
}
