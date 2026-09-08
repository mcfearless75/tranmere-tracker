import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

// Minimal shell for printable reports. Deliberately does NOT render
// AdminSidebar/MobileAdminBar (see app/(admin)/layout.tsx) — these pages are
// meant to open as a clean, print-focused document, not wrapped in the full
// app chrome. Same staff-only gate as (admin)/layout.tsx: that layout's role
// check was the only thing protecting these pages (the pages themselves only
// check for a logged-in user, not role), so this must be preserved here.
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
