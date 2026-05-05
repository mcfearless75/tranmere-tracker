import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { StudentPlanner } from './StudentPlanner'
import { CheckInFlow } from './CheckInFlow'

export const dynamic = 'force-dynamic'

export default async function StudentAttendancePage({
  searchParams,
}: {
  searchParams: { session?: string; manual?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // ── Manual PIN entry (legacy / fallback) ─────────────────────────────────
  // Imports the original plain PIN-search flow via the CheckInFlow component
  // with no session pre-selected (session prop will be null guard handled below)

  // ── Specific session check-in ─────────────────────────────────────────────
  if (searchParams.session) {
    const { data: session } = await admin
      .from('attendance_sessions')
      .select('id, session_label, session_type, pin_code, pin_expires_at, opens_at, closes_at')
      .eq('id', searchParams.session)
      .maybeSingle()

    if (!session) redirect('/attendance')

    // Already checked in?
    const { data: existing } = await admin
      .from('attendance_records')
      .select('id, checked_in_at')
      .eq('session_id', session.id)
      .eq('student_id', user.id)
      .maybeSingle()

    return <CheckInFlow session={session} existingRecord={existing ?? null} />
  }

  // ── Manual PIN fallback ───────────────────────────────────────────────────
  if (searchParams.manual) {
    // Return a minimal shell that lets the ManualPin client component handle it
    const { ManualPin } = await import('./ManualPin')
    return <ManualPin />
  }

  // ── Today's planner ───────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const { data: sessions } = await admin
    .from('attendance_sessions')
    .select('id, session_label, session_type, opens_at, closes_at, pin_expires_at')
    .eq('scheduled_date', today)
    .order('opens_at')

  const sessionIds = (sessions ?? []).map(s => s.id)

  let myRecords: { session_id: string; checked_in_at: string }[] = []
  if (sessionIds.length > 0) {
    const { data } = await admin
      .from('attendance_records')
      .select('session_id, checked_in_at')
      .eq('student_id', user.id)
      .in('session_id', sessionIds)
    myRecords = data ?? []
  }

  return (
    <StudentPlanner
      sessions={sessions ?? []}
      myRecords={myRecords}
      today={today}
    />
  )
}
