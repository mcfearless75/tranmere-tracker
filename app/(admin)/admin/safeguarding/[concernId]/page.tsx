import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SafeguardingConcern, SafeguardingNote } from '@/lib/safeguarding/safeguardingUtils'
import { ConcernDetail } from '@/components/admin/safeguarding/ConcernDetail'

export const dynamic = 'force-dynamic'

export default async function ConcernDetailPage({
  params,
}: {
  params: { concernId: string }
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

  const { data: concernRow } = await admin
    .from('safeguarding_concerns')
    .select('*')
    .eq('id', params.concernId)
    .maybeSingle()

  if (!concernRow) notFound()
  const concern = concernRow as SafeguardingConcern

  const { data: noteRows } = await admin
    .from('safeguarding_notes')
    .select('*')
    .eq('concern_id', params.concernId)
    .order('created_at', { ascending: true })

  const notes = (noteRows ?? []) as SafeguardingNote[]

  // Resolve names for the student and note authors
  const ids = Array.from(
    new Set([
      concern.student_id,
      ...notes.map(n => n.author_id).filter((id): id is string => Boolean(id)),
    ]),
  )

  const nameMap: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: users } = await admin.from('users').select('id, name').in('id', ids)
    for (const u of users ?? []) {
      nameMap[u.id as string] = (u.name as string) ?? 'Unknown'
    }
  }

  const studentName = nameMap[concern.student_id] ?? 'Unknown student'

  return (
    <div className="space-y-4 p-4">
      <Link
        href="/admin/safeguarding"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tranmere-blue"
      >
        <ChevronLeft size={16} /> Back to concerns
      </Link>

      <ConcernDetail
        concern={concern}
        notes={notes}
        studentName={studentName}
        authorNames={nameMap}
      />
    </div>
  )
}
