import { BottomNav } from '@/components/layout/BottomNav'
import { SideNav } from '@/components/layout/SideNav'
import { NativeInit } from '@/components/NativeInit'
import { InstallGuide } from '@/components/pwa/InstallGuide'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/(auth)/login/actions'
import { VALID_TIMETABLE_YEAR_GROUPS } from '@/lib/timetable/timetableUtils'
import { LogOut } from 'lucide-react'
import Image from 'next/image'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await adminClient
    .from('users')
    .select('name, avatar_url, role, year_group, course_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile && ['admin', 'coach', 'teacher'].includes(profile.role)) {
    redirect('/admin/home')
  }

  const showTimetable =
    profile?.year_group != null && VALID_TIMETABLE_YEAR_GROUPS.includes(profile.year_group)
  const showCoursework = profile?.course_id != null

  return (
    <div className="min-h-[100dvh] bg-gray-50 relative overflow-x-hidden">
      <NativeInit />
      <InstallGuide />
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 opacity-[0.04]">
        <img
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt=""
          className="w-96 h-96 object-contain select-none"
        />
      </div>

      <div className="hidden md:flex min-h-[100dvh]">
        <SideNav userName={profile?.name ?? 'Player'} avatarUrl={profile?.avatar_url ?? null} role={profile?.role ?? 'student'} showTimetable={showTimetable} showCoursework={showCoursework} />
        <main className="flex-1 max-w-3xl mx-auto px-8 py-6 relative z-10">{children}</main>
      </div>

      <div className="md:hidden min-h-[100dvh] relative z-10">
        <div className="sticky top-0 z-20 bg-tranmere-blue px-4 py-2.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Image
              src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
              alt="Tranmere Rovers"
              width={22}
              height={22}
            />
            <span className="text-white text-xs font-bold tracking-wide">Tranmere Tracker</span>
          </div>
          <form action={signOut}>
            <button type="submit" className="text-[11px] text-blue-200 hover:text-white flex items-center gap-1.5 transition-colors">
              <LogOut size={11} /> {profile?.name?.split(' ')[0] ?? 'Sign out'}
            </button>
          </form>
        </div>
        <div className="max-w-lg mx-auto">
          <main className="pb-20 px-4 pt-4">{children}</main>
        </div>
        <BottomNav showTimetable={showTimetable} showCoursework={showCoursework} />
      </div>
    </div>
  )
}
