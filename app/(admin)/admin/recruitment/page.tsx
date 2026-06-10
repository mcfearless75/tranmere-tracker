import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProspectList } from '@/components/admin/recruitment/ProspectList'
import { ProspectRow } from '@/components/admin/recruitment/types'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'coach', 'teacher']

export default async function AdminRecruitmentPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) redirect('/admin/dashboard')

  const { data: prospectRows } = await admin
    .from('recruitment_prospects')
    .select('*')
    .order('created_at', { ascending: false })

  const prospects = (prospectRows ?? []) as ProspectRow[]

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-tranmere-blue">
            <UserPlus size={20} /> Recruitment
          </h1>
          <p className="text-sm text-muted-foreground">Prospect pipeline and trial events</p>
        </div>
        <Link
          href="/admin/recruitment/trials"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-tranmere-blue px-3 py-2 text-sm font-semibold text-white active:opacity-90"
        >
          <CalendarDays size={16} /> Trials
        </Link>
      </div>

      <ProspectList prospects={prospects} />
    </div>
  )
}
