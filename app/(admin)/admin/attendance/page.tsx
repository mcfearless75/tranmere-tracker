import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { londonDateISO, londonWallTimeToUTC } from '@/lib/dates'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardList, ChevronLeft, ChevronRight,
  CheckCircle2, AlertTriangle, UserX, Sun, Moon, ArrowRightCircle,
  Printer, Download, Settings, UtensilsCrossed, FileText,
} from 'lucide-react'
import { OverrideButton } from './OverrideButton'
import { excusalCoversPhase } from '@/lib/attendance/excusal'
import { ExcuseButton } from './ExcuseButton'
import { ExcusedPill } from './ExcusedPill'
import { MissingRowActions } from '@/components/attendance/MissingRowActions'
import type { PhaseWindows } from '@/lib/attendance/phase'
import { buildStudentDayStatus, applyStaffFilter, defaultStaffFilter, dayDots, type StudentDayStatus, type Phase } from '@/lib/attendance/dayStatus'

export const dynamic = 'force-dynamic'

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : null
}

const FILTERS: { key: 'all' | 'missing_am' | 'missing_lunch' | 'missing_pm' | 'flagged'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'missing_am', label: 'Missing AM' },
  { key: 'missing_lunch', label: 'Missing lunch' },
  { key: 'missing_pm', label: 'Missing PM' },
  { key: 'flagged', label: 'Flagged' },
]

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { date?: string; filter?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const now = new Date()
  const today = londonDateISO(now)
  // Validate ?date= — an arbitrary string would give Invalid Date and make
  // shiftDate() throw on toISOString(). Fall back to today.
  const rawDate = searchParams.date
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !isNaN(Date.parse(rawDate + 'T12:00:00Z'))
    ? rawDate
    : today
  const isToday = date === today

  const { data: settings } = await admin
    .from('academy_settings')
    .select('am_window_start, am_window_end, lunch_window_start, lunch_window_end, pm_window_start, pm_window_end')
    .eq('id', 1)
    .maybeSingle()
  const windows: PhaseWindows = {
    am:    { start: settings?.am_window_start    ?? '07:30', end: settings?.am_window_end    ?? '10:30' },
    lunch: { start: settings?.lunch_window_start ?? '11:00', end: settings?.lunch_window_end ?? '14:30' },
    pm:    { start: settings?.pm_window_start    ?? '14:30', end: settings?.pm_window_end    ?? '17:30' },
  }

  // The time-of-day default only makes sense for today; a past/future date
  // just starts on "all".
  const requestedFilter = searchParams.filter
  const validFilter = FILTERS.some(f => f.key === requestedFilter) ? (requestedFilter as typeof FILTERS[number]['key']) : null
  const filter = validFilter ?? (isToday ? defaultStaffFilter(windows, now) : 'all')

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Roster + records + excusals in parallel
  const [{ data: students }, { data: records }, { data: excusals }] = await Promise.all([
    admin.from('users').select('id, name, avatar_url').eq('role', 'student').eq('is_active', true).order('name'),
    admin
      .from('daily_attendance')
      .select('student_id, am_checked_at, lunch_checked_at, pm_checked_at, am_is_flagged, lunch_is_flagged, pm_is_flagged, am_flag_reason, lunch_flag_reason, pm_flag_reason, am_selfie_path, pm_selfie_path')
      .eq('attendance_date', date),
    admin
      .from('attendance_excusals')
      .select('student_id, reason, note, phases')
      .eq('excused_date', date),
  ])

  const recMap = new Map((records ?? []).map(r => [r.student_id, r]))
  const excusalMap = new Map((excusals ?? []).map(e => [e.student_id, e]))

  type StudentRow = {
    id: string
    name: string
    avatar_url: string | null
    am: string | null
    lunch: string | null
    pm: string | null
    am_flagged: boolean
    lunch_flagged: boolean
    pm_flagged: boolean
    am_reason: string | null
    lunch_reason: string | null
    pm_reason: string | null
    excusal: { reason: 'ill' | 'appointment' | 'other'; note: string | null; phases: string[] } | null
  }

  const rows: StudentRow[] = (students ?? []).map(s => {
    const r = recMap.get(s.id)
    const e = excusalMap.get(s.id)
    return {
      id: s.id,
      name: s.name,
      avatar_url: s.avatar_url,
      am: r?.am_checked_at ?? null,
      lunch: r?.lunch_checked_at ?? null,
      pm: r?.pm_checked_at ?? null,
      am_flagged: r?.am_is_flagged ?? false,
      lunch_flagged: r?.lunch_is_flagged ?? false,
      pm_flagged: r?.pm_is_flagged ?? false,
      am_reason: r?.am_flag_reason ?? null,
      lunch_reason: r?.lunch_flag_reason ?? null,
      pm_reason: r?.pm_flag_reason ?? null,
      excusal: e ? { reason: e.reason, note: e.note, phases: e.phases } : null,
    }
  })

  const amIn    = rows.filter(r => r.am).length
  const lunchIn = rows.filter(r => r.lunch).length
  const pmOut   = rows.filter(r => r.pm).length
  const flagged = rows.filter(r => r.am_flagged || r.lunch_flagged || r.pm_flagged).length

  // Window-open decisions need a real instant: "now" for today, but the end
  // of the day for a past date (nothing is "not_yet" any more) and the start
  // for a future one (nothing is "missing" yet) — otherwise a staff member
  // looking at yesterday at 08:00 today would see yesterday's lunch/PM as
  // "not yet", not "missing".
  const statusInstant = date === today ? now
    : date < today ? londonWallTimeToUTC(date, '23:59')
    : londonWallTimeToUTC(date, '00:00')

  const statusById = new Map<string, StudentDayStatus>(
    rows.map(r => [r.id, buildStudentDayStatus(
      r.id,
      {
        am:    { checkedAt: r.am,    isFlagged: r.am_flagged,    flagReason: r.am_reason },
        lunch: { checkedAt: r.lunch, isFlagged: r.lunch_flagged, flagReason: r.lunch_reason },
        pm:    { checkedAt: r.pm,    isFlagged: r.pm_flagged,    flagReason: r.pm_reason },
      },
      windows,
      statusInstant,
      (r.excusal?.phases ?? []) as Phase[],
    )])
  )
  const statuses = rows.map(r => statusById.get(r.id)!)
  const amMissing    = applyStaffFilter(statuses, 'missing_am').length
  const lunchMissing = applyStaffFilter(statuses, 'missing_lunch').length
  const pmMissing    = applyStaffFilter(statuses, 'missing_pm').length

  const visibleIds = new Set(applyStaffFilter(statuses, filter).map(s => s.studentId))
  const visibleRows = rows.filter(r => visibleIds.has(r.id))

  // Sort: genuinely missing first, then by name
  const isGenuinelyMissing = (id: string) =>
    (['am', 'lunch', 'pm'] as const).some(p => statusById.get(id)!.phases[p].state === 'missing')
  visibleRows.sort((a, b) => {
    const aMissing = isGenuinelyMissing(a.id)
    const bMissing = isGenuinelyMissing(b.id)
    if (aMissing !== bMissing) return aMissing ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList size={22} className="text-tranmere-blue" />
          <h1 className="text-xl font-bold text-tranmere-blue">Daily Attendance</h1>
          <Link
            href="/admin/attendance/health"
            className="text-xs font-medium text-tranmere-blue underline underline-offset-2"
          >
            Check-in health
          </Link>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/attendance/settings"
            className="flex items-center gap-1.5 text-sm font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Settings size={15} />
            Settings
          </Link>
        </div>
      </div>

      {/* Date navigator */}
      <div className="flex items-center justify-between bg-white border rounded-xl px-3 py-2">
        <Link
          href={`/admin/attendance?date=${shiftDate(date, -1)}`}
          className="p-2 rounded-lg hover:bg-gray-100 text-muted-foreground"
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </Link>
        <div className="text-center">
          <p className="text-sm font-bold text-tranmere-blue">{dateLabel}</p>
          {!isToday && (
            <Link href="/admin/attendance" className="text-[11px] text-tranmere-blue underline">Jump to today</Link>
          )}
        </div>
        <Link
          href={`/admin/attendance?date=${shiftDate(date, 1)}`}
          className="p-2 rounded-lg hover:bg-gray-100 text-muted-foreground"
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        <SummaryTile icon={<Sun size={14} />}             label="AM checked"    value={`${amIn}/${rows.length}`} tone="blue" />
        <SummaryTile icon={<UtensilsCrossed size={14} />} label="Lunch checked" value={`${lunchIn}/${rows.length}`} tone="green" />
        <SummaryTile icon={<Moon size={14} />}            label="PM checked"    value={`${pmOut}/${rows.length}`} tone="purple" />
        <SummaryTile icon={<UserX size={14} />}           label="Missing lunch" value={`${lunchMissing}`} tone={lunchMissing > 0 ? 'red' : 'gray'} />
        <SummaryTile icon={<UserX size={14} />}           label="Missing PM"    value={`${pmMissing}`} tone={pmMissing > 0 ? 'red' : 'gray'} />
        <SummaryTile icon={<AlertTriangle size={14} />}   label="Flagged"       value={`${flagged}`} tone={flagged > 0 ? 'amber' : 'gray'} />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <Link
            key={f.key}
            href={`/admin/attendance?date=${date}&filter=${f.key}`}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors ${
              filter === f.key
                ? 'bg-tranmere-blue text-white'
                : 'bg-gray-100 text-muted-foreground hover:bg-gray-200'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Roster */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="hidden sm:grid sm:grid-cols-[1fr_110px_110px_110px] items-center px-4 py-2.5 border-b bg-gray-50/60 text-[11px] font-bold uppercase tracking-wide text-muted-foreground gap-3">
          <span>Student</span>
          <span className="text-center">AM</span>
          <span className="text-center">Lunch</span>
          <span className="text-center">PM</span>
        </div>

        {visibleRows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {rows.length === 0 ? 'No students enrolled' : 'No one matches this filter'}
          </p>
        ) : (
          <ul className="divide-y">
            {visibleRows.map(r => {
              const status = statusById.get(r.id)!
              const filled = new Set(dayDots(status))
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_110px_110px_110px] sm:items-center px-4 py-2.5 sm:gap-3 text-sm hover:bg-gray-50/60 transition-colors"
                >
                  <div className="flex items-center flex-wrap gap-2.5 min-w-0">
                    <Link href={`/admin/students/${r.id}`} className="flex items-center gap-2.5 min-w-0 hover:underline">
                      {r.avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={r.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                        : <div className="w-7 h-7 rounded-full bg-tranmere-blue/10 flex items-center justify-center text-tranmere-blue text-[10px] font-bold shrink-0">
                            {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                      }
                      <span className="font-medium truncate">{r.name}</span>
                    </Link>
                    <span className="flex items-center gap-1" aria-label="AM, lunch, PM status">
                      {(['am', 'lunch', 'pm'] as const).map(p => (
                        <span
                          key={p}
                          aria-label={`${p} ${filled.has(p) ? 'done' : 'not done'}`}
                          className={`w-1.5 h-1.5 rounded-full ${filled.has(p) ? 'bg-green-500' : 'bg-gray-300'}`}
                        />
                      ))}
                    </span>
                    <ExcuseButton studentId={r.id} date={date} excusal={r.excusal ? { reason: r.excusal.reason, note: r.excusal.note } : null} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:contents">
                    <PhaseCell time={r.am}    flagged={r.am_flagged}    reason={r.am_reason}    studentId={r.id} studentName={r.name} date={date} phase="am"    excusal={r.excusal} filter={filter} />
                    <PhaseCell time={r.lunch} flagged={r.lunch_flagged} reason={r.lunch_reason} studentId={r.id} studentName={r.name} date={date} phase="lunch" excusal={r.excusal} filter={filter} />
                    <PhaseCell time={r.pm}    flagged={r.pm_flagged}    reason={r.pm_reason}    studentId={r.id} studentName={r.name} date={date} phase="pm"    excusal={r.excusal} filter={filter} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Export bar */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/attendance/print?date=${date}&phase=both`}
          className="flex items-center gap-1.5 text-sm font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Printer size={14} /> Print full report
        </Link>
        <a
          href={`/api/attendance/export-csv?date=${date}`}
          className="flex items-center gap-1.5 text-sm font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download size={14} /> Download CSV
        </a>
        <Link
          href={`/admin/attendance/print/week?start=${date}`}
          className="flex items-center gap-1.5 text-sm font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <FileText size={14} /> Weekly report (for college)
        </Link>
      </div>

      {/* End-of-period reports */}
      <div className="grid sm:grid-cols-2 gap-3">
        <ReportCard
          date={date}
          phase="am"
          title="Morning Report"
          subtitle="After AM window (10:30)"
          summary={`${amIn} of ${rows.length} students checked in`}
          missingCount={amMissing}
          missingNames={rows.filter(r => !r.am).map(r => r.name)}
          tone="blue"
        />
        <ReportCard
          date={date}
          phase="pm"
          title="End-of-Day Report"
          subtitle="After PM window (17:30)"
          summary={`${pmOut} of ${rows.length} students checked out`}
          missingCount={pmMissing}
          missingNames={rows.filter(r => !r.pm).map(r => r.name)}
          tone="purple"
        />
      </div>
    </div>
  )
}

function SummaryTile({
  icon, label, value, tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'blue' | 'green' | 'purple' | 'red' | 'amber' | 'gray'
}) {
  const colours = {
    blue:   'border-blue-200 bg-blue-50/60 text-blue-800',
    green:  'border-green-200 bg-green-50/60 text-green-800',
    purple: 'border-purple-200 bg-purple-50/60 text-purple-800',
    red:    'border-red-200 bg-red-50/60 text-red-800',
    amber:  'border-amber-200 bg-amber-50/60 text-amber-800',
    gray:   'border-border bg-gray-50/40 text-muted-foreground',
  }[tone]

  return (
    <div className={`rounded-xl border p-3 ${colours}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80">
        {icon} {label}
      </div>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  )
}

function PhaseCell({
  time, flagged, reason, studentId, studentName, date, phase, excusal, filter,
}: {
  time: string | null
  flagged: boolean
  reason: string | null
  studentId: string
  studentName: string
  date: string
  phase: 'am' | 'lunch' | 'pm'
  excusal: { reason: 'ill' | 'appointment' | 'other'; note: string | null; phases: string[] } | null
  filter: string
}) {
  if (!time && excusalCoversPhase(excusal, phase)) {
    return (
      <ExcusedPill
        studentId={studentId}
        date={date}
        phase={phase}
        reason={excusal!.reason}
        note={excusal!.note}
      />
    )
  }
  if (!time) {
    // The compact Excuse/Mark-present pair only renders for rows matching
    // the currently-active missing_<phase> filter (final-review Finding 3)
    // — showing it in every filter view meant up to 3 button-pairs per row
    // at once on mobile, and made it trivially easy to fire the same
    // per-phase excuse action twice back to back on one row (see the
    // Finding 1 excusal-merge fix). Every other filter falls back to the
    // plain OverrideButton, exactly as it rendered before this branch.
    return (
      <span className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
        <span aria-label="Missing">—</span>
        {filter === `missing_${phase}` ? (
          <MissingRowActions studentId={studentId} studentName={studentName} date={date} phase={phase} />
        ) : (
          <OverrideButton studentId={studentId} date={date} phase={phase} present={false} />
        )}
      </span>
    )
  }
  return (
    <span className="flex items-center justify-center gap-1 text-xs font-medium text-green-700">
      <CheckCircle2 size={13} className="text-green-500" />
      {fmtTime(time)}
      {flagged && (
        <span title={reason ?? 'Flagged'} className="ml-0.5">
          <AlertTriangle size={11} className="text-amber-500" />
        </span>
      )}
      <OverrideButton studentId={studentId} date={date} phase={phase} present={true} />
    </span>
  )
}

function ReportCard({
  date, phase, title, subtitle, summary, missingCount, missingNames, tone,
}: {
  date: string
  phase: 'am' | 'pm'
  title: string
  subtitle: string
  summary: string
  missingCount: number
  missingNames: string[]
  tone: 'blue' | 'purple'
}) {
  const Icon = tone === 'blue' ? Sun : Moon
  const ring = tone === 'blue' ? 'border-blue-200' : 'border-purple-200'

  return (
    <div className={`bg-white border rounded-xl p-4 space-y-2 ${ring}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} className={tone === 'blue' ? 'text-blue-600' : 'text-purple-600'} />
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <ArrowRightCircle size={14} className="ml-auto text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{summary}</p>
      {missingCount > 0 ? (
        <div className="text-xs text-muted-foreground border-t pt-2">
          <p className="font-semibold text-red-600 mb-1">Missing ({missingCount}):</p>
          <p className="leading-relaxed">{missingNames.slice(0, 8).join(', ')}{missingNames.length > 8 && `, +${missingNames.length - 8} more`}</p>
        </div>
      ) : (
        <p className="text-xs text-green-600 border-t pt-2 font-medium">✓ Everyone accounted for</p>
      )}
      <div className="flex gap-2 pt-1 border-t mt-1">
        <Link
          href={`/admin/attendance/print?date=${date}&phase=${phase}`}
          className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold rounded-md py-1.5 transition-colors ${
            tone === 'blue' ? 'text-blue-700 hover:bg-blue-50' : 'text-purple-700 hover:bg-purple-50'
          }`}
        >
          <Printer size={11} /> Print / PDF
        </Link>
        <a
          href={`/api/attendance/export-csv?date=${date}`}
          className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold rounded-md py-1.5 transition-colors ${
            tone === 'blue' ? 'text-blue-700 hover:bg-blue-50' : 'text-purple-700 hover:bg-purple-50'
          }`}
        >
          <Download size={11} /> CSV
        </a>
      </div>
    </div>
  )
}
