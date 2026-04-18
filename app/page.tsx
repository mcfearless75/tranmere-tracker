import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use service client to bypass RLS and reliably get role
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile && ['admin', 'coach', 'teacher'].includes(profile.role)) {
    redirect('/admin/gps-dashboard')
  }

  redirect('/dashboard')
}
