import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AttendanceLive } from './AttendanceLive'

export const dynamic = 'force-dynamic'

export default async function AttendanceSessionPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  const { data: session } = await adminClient
    .from('attendance_sessions')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!session) notFound()

  const { data: records } = await adminClient
    .from('attendance_records')
    .select(`
      id, checked_in_at, method, is_flagged, flag_reason,
      client_ip, geo_lat, geo_lng, geo_accuracy_m, selfie_path,
      users:student_id (id, name, avatar_url)
    `)
    .eq('session_id', params.id)
    .order('checked_in_at', { ascending: true })

  // All enrolled students for manual override
  const { data: allStudents } = await adminClient
    .from('users')
    .select('id, name, avatar_url')
    .eq('role', 'student')
    .order('name')

  return (
    <AttendanceLive
      session={session}
      initialRecords={(records ?? []) as unknown as Parameters<typeof AttendanceLive>[0]['initialRecords']}
      allStudents={allStudents ?? []}
      coachId={user.id}
    />
  )
}
