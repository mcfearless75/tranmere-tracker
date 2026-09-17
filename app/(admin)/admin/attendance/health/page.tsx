import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Activity, AlertTriangle, UserX, Repeat } from 'lucide-react'
import { londonDateISO } from '@/lib/dates'
import type { AttendancePhase, PhaseWindows } from '@/lib/attendance/phase'
import {
  computeCheckInHealth,
  isCheckInHealthEmpty,
  lastNLondonWeekdays,
  type HealthAttendanceRecord,
  type ExcusalsByStudentDate,
  type FlagCategory,
} from '@/lib/attendance/healthStats'
import { PhaseCompletionChart, FlagBreakdownChart } from '@/components/attendance/CheckInHealthCharts'

export const dynamic = 'force-dynamic'

const WINDOW_OPTIONS = [7, 28] as const
const REPEAT_CAP = 20

const FLAG_LABELS: Record<FlagCategory, string> = {
  no_gps: 'No GPS',
  permission_denied: 'Permission denied',
  coarse_fix: 'Coarse fix',
  outside_fence: 'Outside fence',
  other: 'Other',
}

export default async function CheckInHealthPage({
  searchParams,
}: {
  searchParams: { window?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const now = new Date()
  const today = londonDateISO(now)

  const rawWindow = Number(searchParams.window)
  const windowDays: number = WINDOW_OPTIONS.includes(rawWindow as 7 | 28) ? rawWindow : 7

  // Fetch the widest range either toggle needs in one go — the aggregator
  // only reads the dates it needs internally, so an unused day's rows for
  // the 7-day view are simply never looked up.
  const maxRange = lastNLondonWeekdays(28, today)
  const oldest = maxRange[0]

  const [{ data: settings }, { data: students }, { data: records }, { data: excusals }] = await Promise.all([
    admin
      .from('academy_settings')
      .select('am_window_start, am_window_end, lunch_window_start, lunch_window_end, pm_window_start, pm_window_end')
      .eq('id', 1)
      .maybeSingle(),
    admin.from('users').select('id, name').eq('role', 'student').eq('is_active', true).order('name'),
    admin
      .from('daily_attendance')
      .select('student_id, attendance_date, am_checked_at, lunch_checked_at, pm_checked_at, am_is_flagged, lunch_is_flagged, pm_is_flagged, am_flag_reason, lunch_flag_reason, pm_flag_reason')
      .gte('attendance_date', oldest)
      .lte('attendance_date', today),
    admin
      .from('attendance_excusals')
      .select('student_id, excused_date, phases')
      .gte('excused_date', oldest)
      .lte('excused_date', today),
  ])

  const windows: PhaseWindows = {
    am:    { start: settings?.am_window_start    ?? '07:30', end: settings?.am_window_end    ?? '10:30' },
    lunch: { start: settings?.lunch_window_start ?? '11:00', end: settings?.lunch_window_end ?? '14:30' },
    pm:    { start: settings?.pm_window_start    ?? '14:30', end: settings?.pm_window_end    ?? '17:30' },
  }

  const excusalsByStudentDate: ExcusalsByStudentDate = new Map(
    (excusals ?? []).map(e => [`${e.student_id}|${e.excused_date}`, e.phases as AttendancePhase[]])
  )

  const stats = computeCheckInHealth(
    students ?? [],
    (records ?? []) as HealthAttendanceRecord[],
    windows,
    windowDays,
    today,
    now,
    excusalsByStudentDate,
  )

  // Gate emptiness on whether anything was EXPECTED in the window, not on
  // whether anything was TAPPED — zero taps against a non-zero expected
  // count is a total check-in outage (exactly the September incident this
  // page exists to surface), not an empty academy. That state must render
  // the real (alarming) 0%/100% figures below, not this message. See
  // isCheckInHealthEmpty's doc comment (lib/attendance/healthStats.ts).
  const isEmpty = isCheckInHealthEmpty((students ?? []).length, stats)

  const completionData = [
    { phase: 'AM', pct: stats.phaseCompletion.am.pct ?? 0 },
    { phase: 'Lunch', pct: stats.phaseCompletion.lunch.pct ?? 0 },
    { phase: 'PM', pct: stats.phaseCompletion.pm.pct ?? 0 },
  ]

  const flagData = (Object.keys(FLAG_LABELS) as FlagCategory[]).map(category => ({
    category: FLAG_LABELS[category],
    count: stats.flagBreakdown[category],
  }))

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity size={22} className="text-tranmere-blue" />
          <div>
            <h1 className="text-xl font-bold text-tranmere-blue">Check-in health</h1>
            <p className="text-xs text-muted-foreground">
              Attendance-tap reliability — {stats.dateRange[0]} to {stats.dateRange[stats.dateRange.length - 1]}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {WINDOW_OPTIONS.map(w => (
            <Link
              key={w}
              href={`/admin/attendance/health?window=${w}`}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                windowDays === w
                  ? 'bg-tranmere-blue text-white'
                  : 'bg-gray-100 text-muted-foreground hover:bg-gray-200'
              }`}
            >
              {w} days
            </Link>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-white border rounded-xl p-6 text-center text-sm text-muted-foreground">
          No check-ins in this window.
        </div>
      ) : (
        <>
          {/* Phase completion */}
          <div className="bg-white border rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Phase completion
            </p>
            <PhaseCompletionChart data={completionData} />
          </div>

          {/* Missing lunch / PM rate */}
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile
              icon={<UserX size={14} />}
              label="Missing lunch rate"
              value={stats.missingRate.lunch.pct !== null ? `${stats.missingRate.lunch.pct}%` : '—'}
              tone={(stats.missingRate.lunch.pct ?? 0) > 10 ? 'red' : 'gray'}
            />
            <StatTile
              icon={<UserX size={14} />}
              label="Missing PM rate"
              value={stats.missingRate.pm.pct !== null ? `${stats.missingRate.pm.pct}%` : '—'}
              tone={(stats.missingRate.pm.pct ?? 0) > 10 ? 'red' : 'gray'}
            />
          </div>

          {/* Flagged rate + breakdown */}
          <div className="bg-white border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Flagged rate
              </p>
              <p className="text-sm font-bold text-amber-700">
                {stats.flaggedRate.pct !== null ? `${stats.flaggedRate.pct}%` : '—'}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({stats.flaggedRate.flaggedCount} of {stats.flaggedRate.totalTaps} taps)
                </span>
              </p>
            </div>
            <FlagBreakdownChart data={flagData} />
          </div>

          {/* Repeat location-denied */}
          <div className="bg-white border rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <Repeat size={15} className="text-amber-600" />
              <p className="text-sm font-semibold">Repeat location-denied (2+ days)</p>
              {stats.repeatLocationDenied.length > 0 && (
                <span className="text-xs font-bold text-muted-foreground">{stats.repeatLocationDenied.length}</span>
              )}
            </div>
            {stats.repeatLocationDenied.length === 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-green-700">
                <AlertTriangle size={14} className="text-green-600" /> None
              </p>
            ) : (
              <ul className="divide-y">
                {stats.repeatLocationDenied.slice(0, REPEAT_CAP).map(s => (
                  <li key={s.studentId} className="flex items-center justify-between py-1.5 text-sm">
                    <Link href={`/admin/students/${s.studentId}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{s.days} days</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatTile({
  icon, label, value, tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'red' | 'gray'
}) {
  const colours = tone === 'red'
    ? 'border-red-200 bg-red-50/60 text-red-800'
    : 'border-border bg-gray-50/40 text-muted-foreground'
  return (
    <div className={`rounded-xl border p-3 ${colours}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80">
        {icon} {label}
      </div>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  )
}
