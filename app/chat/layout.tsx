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
    <>
      {/* ── Desktop: permanent sidebar + scrollable main ── */}
      <div className="hidden md:flex h-screen overflow-hidden bg-gray-50">
        <SideNav
          userName={profile?.name ?? 'Player'}
          avatarUrl={profile?.avatar_url ?? null}
          role={profile?.role ?? 'student'}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>

      {/* ── Mobile: full-height content + bottom nav ── */}
      <div className="md:hidden">
        {children}
        <BottomNav />
      </div>
    </>
  )
}
