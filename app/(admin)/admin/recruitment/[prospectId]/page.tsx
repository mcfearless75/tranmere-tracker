import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProspectDetail } from '@/components/admin/recruitment/ProspectDetail'
import {
  ProspectRow,
  ProspectNoteRow,
  ProspectTrialHistory,
} from '@/components/admin/recruitment/types'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'coach', 'teacher']

type AttendanceJoinRow = {
  id: string
  attended: boolean
  rating: number | null
  scout_notes: string | null
  trial_events: { title: string; event_date: string } | null
}

export default async function ProspectDetailPage({
  params,
}: {
  params: { prospectId: string }
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

  if (!profile || !STAFF_ROLES.includes(profile.role)) redirect('/admin/dashboard')

  const { data: prospectRow } = await admin
    .from('recruitment_prospects')
    .select('*')
    .eq('id', params.prospectId)
    .maybeSingle()

  if (!prospectRow) notFound()
  const prospect = prospectRow as ProspectRow

  const { data: noteRows } = await admin
    .from('prospect_notes')
    .select('*')
    .eq('prospect_id', params.prospectId)
    .order('created_at', { ascending: true })

  const notes = (noteRows ?? []) as ProspectNoteRow[]

  // Trial attendance history with the event details joined in
  const { data: attendanceRows } = await admin
    .from('trial_attendees')
    .select('id, attended, rating, scout_notes, trial_events(title, event_date)')
    .eq('prospect_id', params.prospectId)

  const trialHistory: ProspectTrialHistory[] = ((attendanceRows ?? []) as unknown as AttendanceJoinRow[])
    .map(row => ({
      id: row.id,
      attended: row.attended,
      rating: row.rating,
      scout_notes: row.scout_notes,
      eventTitle: row.trial_events?.title ?? 'Unknown event',
      eventDate: row.trial_events?.event_date ?? '',
    }))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate))

  // Resolve names for note authors
  const authorIds = Array.from(new Set(notes.map(n => n.author_id)))
  const authorNames: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: users } = await admin.from('users').select('id, name').in('id', authorIds)
    for (const u of users ?? []) {
      authorNames[u.id as string] = (u.name as string) ?? 'Staff'
    }
  }

  return (
    <div className="space-y-4 p-4">
      <Link
        href="/admin/recruitment"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tranmere-blue"
      >
        <ChevronLeft size={16} /> Back to pipeline
      </Link>

      <ProspectDetail
        prospect={prospect}
        notes={notes}
        trialHistory={trialHistory}
        authorNames={authorNames}
      />
    </div>
  )
}
