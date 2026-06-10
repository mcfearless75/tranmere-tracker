import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TrialEventForm } from '@/components/admin/recruitment/TrialEventForm'
import { TrialEventRow } from '@/components/admin/recruitment/types'
import { formatDate } from '@/components/admin/recruitment/formatters'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'coach', 'teacher']

export default async function TrialEventsPage() {
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

  const { data: eventRows } = await admin
    .from('trial_events')
    .select('*')
    .order('event_date', { ascending: false })

  const events = (eventRows ?? []) as TrialEventRow[]

  return (
    <div className="space-y-5 p-4">
      <Link
        href="/admin/recruitment"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tranmere-blue"
      >
        <ChevronLeft size={16} /> Back to pipeline
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-tranmere-blue">
          <CalendarDays size={20} /> Trial events
        </h1>
        <p className="text-sm text-muted-foreground">Schedule trials and track attendance</p>
      </div>

      <TrialEventForm />

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trial events yet.</p>
      ) : (
        <ul className="space-y-2">
          {events.map(ev => (
            <li key={ev.id}>
              <Link
                href={`/admin/recruitment/trials/${ev.id}`}
                className="block rounded-2xl border border-gray-200 bg-white p-3 active:opacity-90"
              >
                <p className="font-semibold text-gray-900">{ev.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(ev.event_date)}
                  {ev.location ? ` · ${ev.location}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
