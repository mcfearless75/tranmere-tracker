import { BottomNav } from '@/components/layout/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <div className="max-w-lg mx-auto relative min-h-[100dvh]">
        <main className="pb-20 px-4 pt-4">{children}</main>
        <BottomNav />
      </div>
    </div>
  )
}
