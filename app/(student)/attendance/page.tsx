import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { decidePhase, type PhaseWindows } from '@/lib/attendance/phase'
import { StudentPlanner } from './StudentPlanner'
import { AutoCheckIn } from './AutoCheckIn'

export const dynamic = 'force-dynamic'

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
    .select('nfc_token, am_window_start, am_window_end, lunch_window_start, lunch_window_end, pm_window_start, pm_window_end')
    .eq('id', 1)
    .single()

  const windows: PhaseWindows = {
    am:    { start: settings?.am_window_start    ?? '07:30:00', end: settings?.am_window_end    ?? '10:30:00' },
    lunch: { start: settings?.lunch_window_start ?? '11:30:00', end: settings?.lunch_window_end ?? '13:30:00' },
    pm:    { start: settings?.pm_window_start    ?? '14:30:00', end: settings?.pm_window_end    ?? '17:30:00' },
  }

  // Server-side, Europe/London — the single source of truth for "which phase
  // is open right now". Clients receive this instead of re-deriving from the
  // device clock (which may be in another timezone).
  const phase = decidePhase(windows)

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

    if (!phase) {
      const t = (s: string) => s.substring(0, 5)
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-center px-4">
          <h1 className="text-xl font-bold text-tranmere-blue">Out of hours</h1>
          <p className="text-sm text-muted-foreground">
            Morning check-in {t(windows.am.start)}–{t(windows.am.end)},
            lunch check-in {t(windows.lunch.start)}–{t(windows.lunch.end)},
            end of day check-out {t(windows.pm.start)}–{t(windows.pm.end)}.
          </p>
        </div>
      )
    }

    return <AutoCheckIn phase={phase} nfcToken={searchParams.tag} />
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
      .select('am_checked_at, lunch_checked_at, pm_checked_at')
      .eq('student_id', user.id)
      .eq('attendance_date', today)
      .maybeSingle(),
  ])

  return (
    <StudentPlanner
      sessions={sessions ?? []}
      daily={daily ?? null}
      today={today}
      windows={windows}
      serverPhase={phase}
    />
  )
}
