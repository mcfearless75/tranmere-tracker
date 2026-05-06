import { SideNav } from '@/components/layout/SideNav'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { MobileAdminBar } from '@/components/layout/MobileAdminBar'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

const STAFF_ROLES = ['admin', 'coach', 'teacher']

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('name, avatar_url, role')
    .eq('id', user.id)
    .single()

  const isStaff = STAFF_ROLES.includes(profile?.role ?? '')
  const name = profile?.name ?? 'User'
  const avatar = profile?.avatar_url ?? null
  const role = profile?.role ?? 'student'

  return (
    // Single wrapper — children rendered ONCE, CSS handles desktop vs mobile layout
    <div className="md:flex md:h-screen md:overflow-hidden bg-gray-50">
      {/* Desktop: permanent sidebar — admin sidebar for staff, student sidenav for students */}
      <div className="hidden md:block shrink-0">
        {isStaff
          ? <AdminSidebar userName={name} avatarUrl={avatar} role={role} />
          : <SideNav userName={name} avatarUrl={avatar} role={role} />
        }
      </div>

      {/* Content — always rendered once */}
      <main className="flex-1 flex flex-col overflow-x-hidden md:overflow-hidden min-h-[100dvh] md:min-h-0">
        {children}
      </main>

      {/* Mobile nav — admin drawer for staff, bottom tabs for students */}
      {isStaff
        ? <MobileAdminBar userName={name} avatarUrl={avatar} role={role} />
        : <BottomNav />
      }
    </div>
  )
}
