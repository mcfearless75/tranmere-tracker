import { redirect } from 'next/navigation'
import { Banknote } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Bursary } from '@/lib/bursaries/bursaryUtils'
import { BursaryList } from '@/components/admin/bursaries/BursaryList'
import { BursaryForm } from '@/components/admin/bursaries/BursaryForm'

export const dynamic = 'force-dynamic'

export default async function AdminBursariesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()

  // Strictly admins only — bursaries hold financial data, so coaches and
  // teachers are redirected away.
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') redirect('/admin/dashboard')

  const { data: bursaryRows } = await admin
    .from('bursaries')
    .select('*')
    .order('created_at', { ascending: false })

  const bursaries = (bursaryRows ?? []) as Bursary[]

  // Student name lookup
  const studentNames: Record<string, string> = {}
  const studentIds = Array.from(new Set(bursaries.map(b => b.student_id)))
  if (studentIds.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, name')
      .in('id', studentIds)
    for (const u of users ?? []) {
      studentNames[u.id as string] = (u.name as string) ?? 'Unknown'
    }
  }

  // Next due date per bursary (earliest pending payment)
  const nextDueDates: Record<string, string | null> = {}
  if (bursaries.length > 0) {
    const { data: pendingRows } = await admin
      .from('bursary_payments')
      .select('bursary_id, due_date')
      .in('bursary_id', bursaries.map(b => b.id))
      .eq('status', 'pending')
      .order('due_date', { ascending: true })

    for (const row of pendingRows ?? []) {
      const bursaryId = row.bursary_id as string
      if (!(bursaryId in nextDueDates)) {
        nextDueDates[bursaryId] = row.due_date as string
      }
    }
  }

  // Student picker for the create form
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
    <div className="space-y-5 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-tranmere-blue">
          <Banknote size={20} /> Bursaries
        </h1>
        <p className="text-sm text-muted-foreground">Manage bursary awards and payment schedules</p>
      </div>

      <BursaryList bursaries={bursaries} studentNames={studentNames} nextDueDates={nextDueDates} />

      <BursaryForm students={students} />
    </div>
  )
}
