import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Bursary, BursaryPayment } from '@/lib/bursaries/bursaryUtils'
import { BursaryDetail } from '@/components/admin/bursaries/BursaryDetail'

export const dynamic = 'force-dynamic'

export default async function BursaryDetailPage({
  params,
}: {
  params: { bursaryId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()

  // Strictly admins only — financial data.
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') redirect('/admin/dashboard')

  const { data: bursaryRow } = await admin
    .from('bursaries')
    .select('*')
    .eq('id', params.bursaryId)
    .maybeSingle()

  if (!bursaryRow) notFound()
  const bursary = bursaryRow as Bursary

  const { data: paymentRows } = await admin
    .from('bursary_payments')
    .select('*')
    .eq('bursary_id', params.bursaryId)
    .order('due_date', { ascending: true })

  const payments = (paymentRows ?? []) as BursaryPayment[]

  // Resolve names for the student and anyone who marked a payment
  const ids = Array.from(
    new Set([
      bursary.student_id,
      ...payments.map(p => p.marked_by).filter((id): id is string => Boolean(id)),
    ]),
  )

  const nameMap: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: users } = await admin.from('users').select('id, name').in('id', ids)
    for (const u of users ?? []) {
      nameMap[u.id as string] = (u.name as string) ?? 'Unknown'
    }
  }

  const studentName = nameMap[bursary.student_id] ?? 'Unknown student'

  return (
    <div className="space-y-4 p-4">
      <Link
        href="/admin/bursaries"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tranmere-blue"
      >
        <ChevronLeft size={16} /> Back to bursaries
      </Link>

      <BursaryDetail
        bursary={bursary}
        payments={payments}
        studentName={studentName}
        markerNames={nameMap}
      />
    </div>
  )
}
