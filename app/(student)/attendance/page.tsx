import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { StudentPlanner } from './StudentPlanner'
import { NfcCheckIn } from './NfcCheckIn'

export const dynamic = 'force-dynamic'

function decidePhase(amStart: string, amEnd: string, pmStart: string, pmEnd: string): 'am' | 'pm' | null {
  const now    = new Date()
  const local  = new Date(now.toLocaleString('en-GB', { timeZone: 'Europe/London' }))
  const mins   = local.getHours() * 60 + local.getMinutes()
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

  if (mins >= toMins(amStart) && mins <= toMins(amEnd)) return 'am'
  if (mins >= toMins(pmStart) && mins <= toMins(pmEnd)) return 'pm'
  return null
}

export default async function StudentAttendancePage({
  searchParams,
}: {
  searchParams: { tag?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // ── Load academy settings (windows, NFC token) ────────────────────────────
  const { data: settings } = await admin
    .from('academy_settings')
    .select('nfc_token, am_window_start, am_window_end, pm_window_start, pm_window_end')
    .eq('id', 1)
    .single()

  const amWindow = { start: settings?.am_window_start ?? '07:30:00', end: settings?.am_window_end ?? '10:30:00' }
  const pmWindow = { start: settings?.pm_window_start ?? '14:30:00', end: settings?.pm_window_end ?? '17:30:00' }

  // ── NFC tap arrival ────────────────────────────────────────────────────────
  if (searchParams.tag) {
    if (searchParams.tag !== settings?.nfc_token) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-center px-4">
          <h1 className="text-xl font-bold text-red-600">Invalid sticker</h1>
          <p className="text-sm text-muted-foreground">This NFC tag doesn&apos;t match the academy. Ask reception.</p>
        </div>
      )
    }

    const phase = decidePhase(amWindow.start, amWindow.end, pmWindow.start, pmWindow.end)
    if (!phase) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-center px-4">
          <h1 className="text-xl font-bold text-tranmere-blue">Out of hours</h1>
          <p className="text-sm text-muted-foreground">
            Check-in opens {amWindow.start.substring(0, 5)}–{amWindow.end.substring(0, 5)}
            {' '}and check-out {pmWindow.start.substring(0, 5)}–{pmWindow.end.substring(0, 5)}.
          </p>
        </div>
      )
    }

    return <NfcCheckIn phase={phase} nfcToken={searchParams.tag} />
  }

  // ── Default: planner view ─────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const [{ data: sessions }, { data: daily }] = await Promise.all([
    admin
      .from('attendance_sessions')
      .select('id, session_label, session_type, opens_at, closes_at')
      .eq('scheduled_date', today)
      .order('opens_at'),
    admin
      .from('daily_attendance')
      .select('am_checked_at, pm_checked_at')
      .eq('student_id', user.id)
      .eq('attendance_date', today)
      .maybeSingle(),
  ])

  return (
    <StudentPlanner
      sessions={sessions ?? []}
      daily={daily ?? null}
      today={today}
      amWindow={amWindow}
      pmWindow={pmWindow}
    />
  )
}
