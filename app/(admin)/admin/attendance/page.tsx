import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { NewSessionForm } from './NewSessionForm'
import { ClipboardList, CheckCircle, Clock, Users, CalendarDays } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AttendancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  const { data: sessions } = await adminClient
    .from('attendance_sessions')
    .select(`
      id, session_label, session_type, pin_code, pin_expires_at,
      opens_at, closes_at, created_at,
      attendance_records(count)
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  const now = new Date()
  const active = sessions?.filter(s => !s.closes_at || new Date(s.closes_at) > now) ?? []
  const closed = sessions?.filter(s => s.closes_at && new Date(s.closes_at) <= now) ?? []

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={22} className="text-tranmere-blue" />
          <h1 className="text-xl font-bold text-tranmere-blue">Attendance</h1>
        </div>
        <Link
          href="/admin/attendance/schedule"
          className="flex items-center gap-1.5 text-sm font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <CalendarDays size={15} />
          Weekly Schedule
        </Link>
      </div>

      <NewSessionForm coachId={user.id} />

      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Active Sessions
          </h2>
          {active.map(s => (
            <SessionCard key={s.id} s={s} active />
          ))}
        </section>
      )}

      {closed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Past Sessions
          </h2>
          {closed.map(s => (
            <SessionCard key={s.id} s={s} active={false} />
          ))}
        </section>
      )}

      {!sessions?.length && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No sessions yet — create one above to open check-in for students.
        </p>
      )}
    </div>
  )
}

function SessionCard({ s, active }: { s: any; active: boolean }) {
  const count = s.attendance_records?.[0]?.count ?? 0
  return (
    <Link
      href={`/admin/attendance/${s.id}`}
      className="flex items-center justify-between bg-white border rounded-xl px-4 py-3 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center gap-3">
        {active
          ? <Clock size={16} className="text-green-500 shrink-0" />
          : <CheckCircle size={16} className="text-muted-foreground shrink-0" />}
        <div>
          <p className="font-semibold text-sm">{s.session_label}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {s.session_type} · {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Users size={14} />
        <span className="font-medium text-tranmere-blue">{count}</span>
      </div>
    </Link>
  )
}
