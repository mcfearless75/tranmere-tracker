import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AttendeeRow } from '@/components/admin/recruitment/AttendeeRow'
import { AddAttendeeForm, ProspectOption } from '@/components/admin/recruitment/AddAttendeeForm'
import { TrialEventRow, TrialAttendeeRow } from '@/components/admin/recruitment/types'
import { formatDate } from '@/components/admin/recruitment/formatters'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'coach', 'teacher']

type AttendeeJoinRow = TrialAttendeeRow & {
  recruitment_prospects: { first_name: string; last_name: string } | null
}

export default async function TrialEventDetailPage({
  params,
}: {
  params: { trialId: string }
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

  const { data: eventRow } = await admin
    .from('trial_events')
    .select('*')
    .eq('id', params.trialId)
    .maybeSingle()

  if (!eventRow) notFound()
  const event = eventRow as TrialEventRow

  const { data: attendeeRows } = await admin
    .from('trial_attendees')
    .select('*, recruitment_prospects(first_name, last_name)')
    .eq('trial_event_id', params.trialId)

  const attendees = (attendeeRows ?? []) as unknown as AttendeeJoinRow[]

  // Prospects not yet attached to this trial, for the add form
  const attachedIds = new Set(attendees.map(a => a.prospect_id))
  const { data: prospectRows } = await admin
    .from('recruitment_prospects')
    .select('id, first_name, last_name')
    .order('last_name', { ascending: true })

  const options: ProspectOption[] = (prospectRows ?? [])
    .filter(p => !attachedIds.has(p.id as string))
    .map(p => ({
      id: p.id as string,
      name: `${p.first_name} ${p.last_name}`,
    }))

  return (
    <div className="space-y-5 p-4">
      <Link
        href="/admin/recruitment/trials"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tranmere-blue"
      >
        <ChevronLeft size={16} /> Back to trials
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h1 className="text-lg font-bold text-gray-900">{event.title}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDate(event.event_date)}
          {event.location ? ` · ${event.location}` : ''}
        </p>
        {event.notes && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{event.notes}</p>
        )}
      </div>

      <AddAttendeeForm trialEventId={event.id} options={options} />

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-tranmere-blue">Attendees</h2>
        {attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendees yet.</p>
        ) : (
          <ul className="space-y-2">
            {attendees.map(a => (
              <AttendeeRow
                key={a.id}
                attendee={a}
                prospectName={
                  a.recruitment_prospects
                    ? `${a.recruitment_prospects.first_name} ${a.recruitment_prospects.last_name}`
                    : 'Unknown prospect'
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
