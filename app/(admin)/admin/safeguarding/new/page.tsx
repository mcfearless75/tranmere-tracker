import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ConcernForm } from '@/components/admin/safeguarding/ConcernForm'

export const dynamic = 'force-dynamic'

export default async function NewConcernPage({
  searchParams,
}: {
  searchParams: { student?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') redirect('/admin/dashboard')

  const { data: studentRows } = await admin
    .from('users')
    .select('id, name')
    .eq('role', 'student')
    .order('name', { ascending: true })

  const students = (studentRows ?? []).map(s => ({
    id: s.id as string,
    name: (s.name as string) ?? 'Unknown',
  }))

  return (
    <div className="space-y-4 p-4">
      <Link
        href="/admin/safeguarding"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tranmere-blue"
      >
        <ChevronLeft size={16} /> Back to concerns
      </Link>

      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Log a safeguarding concern</h1>
        <p className="text-sm text-muted-foreground">Record details of the concern for the case file</p>
      </div>

      <ConcernForm students={students} defaultStudentId={searchParams.student} />
    </div>
  )
}
