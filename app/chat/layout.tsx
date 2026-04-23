import { SideNav } from '@/components/layout/SideNav'
import { BottomNav } from '@/components/layout/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

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

  return (
    // Single wrapper — children rendered ONCE, CSS handles desktop vs mobile layout
    <div className="md:flex md:h-screen md:overflow-hidden bg-gray-50">
      {/* Desktop: permanent sidebar */}
      <div className="hidden md:block shrink-0">
        <SideNav
          userName={profile?.name ?? 'Player'}
          avatarUrl={profile?.avatar_url ?? null}
          role={profile?.role ?? 'student'}
        />
      </div>

      {/* Content — always rendered once */}
      <main className="flex-1 flex flex-col md:overflow-hidden min-h-[100dvh] md:min-h-0">
        {children}
      </main>

      {/* Mobile bottom nav (md:hidden is in BottomNav itself) */}
      <BottomNav />
    </div>
  )
}
