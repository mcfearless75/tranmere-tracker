import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ParentSidebar } from '@/components/layout/ParentSidebar'
import { MobileParentBar } from '@/components/layout/MobileParentBar'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'
import { LogOut } from 'lucide-react'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('name, avatar_url, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'parent') {
    redirect('/login')
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 relative overflow-hidden">
      {/* Watermark */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 opacity-[0.04]">
        <img
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt=""
          className="w-96 h-96 object-contain select-none"
        />
      </div>

      {/* Desktop: sidebar + content */}
      <div className="hidden md:flex min-h-[100dvh]">
        <ParentSidebar userName={profile.name ?? 'Parent'} avatarUrl={profile.avatar_url ?? null} />
        <main className="flex-1 max-w-4xl mx-auto px-8 py-6 relative z-10">{children}</main>
      </div>

      {/* Mobile */}
      <div className="md:hidden min-h-[100dvh] relative z-10">
        <div className="sticky top-0 z-20 bg-tranmere-blue px-4 py-2.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Image
              src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
              alt="Tranmere Rovers"
              width={22}
              height={22}
            />
            <span className="text-white text-xs font-bold tracking-wide">Parent Portal</span>
          </div>
          <form action={signOut}>
            <button type="submit" className="text-[11px] text-blue-200 hover:text-white flex items-center gap-1.5 transition-colors">
              <LogOut size={11} /> Sign out
            </button>
          </form>
        </div>
        <div className="max-w-lg mx-auto">
          <main className="pb-20 px-4 pt-4">{children}</main>
        </div>
        <MobileParentBar />
      </div>
    </div>
  )
}
