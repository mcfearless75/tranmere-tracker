import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardList, CalendarDays, ChevronLeft, ChevronRight,
  CheckCircle2, AlertTriangle, UserX, Sun, Moon, ArrowRightCircle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const date = searchParams.date ?? today
  const isToday = date === today

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Roster + records in parallel
  const [{ data: students }, { data: records }] = await Promise.all([
    admin.from('users').select('id, name, avatar_url').eq('role', 'student').order('name'),
    admin
      .from('daily_attendance')
      .select('student_id, am_checked_at, pm_checked_at, am_is_flagged, pm_is_flagged, am_flag_reason, pm_flag_reason, am_selfie_path, pm_selfie_path')
      .eq('attendance_date', date),
  ])

  const recMap = new Map((records ?? []).map(r => [r.student_id, r]))

  type StudentRow = {
    id: string
    name: string
    avatar_url: string | null
    am: string | null
    pm: string | null
    am_flagged: boolean
    pm_flagged: boolean
    am_reason: string | null
    pm_reason: string | null
  }

  const rows: StudentRow[] = (students ?? []).map(s => {
    const r = recMap.get(s.id)
    return {
      id: s.id,
      name: s.name,
      avatar_url: s.avatar_url,
      am: r?.am_checked_at ?? null,
      pm: r?.pm_checked_at ?? null,
      am_flagged: r?.am_is_flagged ?? false,
      pm_flagged: r?.pm_is_flagged ?? false,
      am_reason: r?.am_flag_reason ?? null,
      pm_reason: r?.pm_flag_reason ?? null,
    }
  })

  const amIn       = rows.filter(r => r.am).length
  const pmOut      = rows.filter(r => r.pm).length
  const amMissing  = rows.length - amIn
  const pmMissing  = rows.length - pmOut
  const flagged    = rows.filter(r => r.am_flagged || r.pm_flagged).length

  // Sort: missing first, then by name
  rows.sort((a, b) => {
    const aMissing = !a.am || !a.pm
    const bMissing = !b.am || !b.pm
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
        </div>
        <Link
          href="/admin/attendance/schedule"
          className="flex items-center gap-1.5 text-sm font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <CalendarDays size={15} />
          Weekly Schedule
        </Link>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <SummaryTile icon={<Sun size={14} />}        label="AM In"     value={`${amIn}/${rows.length}`} tone="blue" />
        <SummaryTile icon={<Moon size={14} />}       label="PM Out"    value={`${pmOut}/${rows.length}`} tone="purple" />
        <SummaryTile icon={<UserX size={14} />}      label="Missing"   value={`${Math.max(amMissing, pmMissing)}`} tone={amMissing > 0 ? 'red' : 'gray'} />
        <SummaryTile icon={<AlertTriangle size={14} />} label="Flagged" value={`${flagged}`} tone={flagged > 0 ? 'amber' : 'gray'} />
      </div>

      {/* Roster */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_120px_120px] items-center px-4 py-2.5 border-b bg-gray-50/60 text-[11px] font-bold uppercase tracking-wide text-muted-foreground gap-3">
          <span>Student</span>
          <span className="text-center">AM</span>
          <span className="text-center">PM</span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No students enrolled</p>
        ) : (
          <ul className="divide-y">
            {rows.map(r => (
              <li
                key={r.id}
                className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_120px_120px] items-center px-4 py-2.5 gap-3 text-sm hover:bg-gray-50/60 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {r.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    : <div className="w-7 h-7 rounded-full bg-tranmere-blue/10 flex items-center justify-center text-tranmere-blue text-[10px] font-bold shrink-0">
                        {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                  }
                  <span className="font-medium truncate">{r.name}</span>
                </div>
                <PhaseCell time={r.am} flagged={r.am_flagged} reason={r.am_reason} />
                <PhaseCell time={r.pm} flagged={r.pm_flagged} reason={r.pm_reason} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* End-of-period reports */}
      <div className="grid sm:grid-cols-2 gap-3">
        <ReportCard
          title="Morning Report"
          subtitle="After AM window (10:30)"
          summary={`${amIn} of ${rows.length} students checked in`}
          missingCount={amMissing}
          missingNames={rows.filter(r => !r.am).map(r => r.name)}
          tone="blue"
        />
        <ReportCard
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
  tone: 'blue' | 'purple' | 'red' | 'amber' | 'gray'
}) {
  const colours = {
    blue:   'border-blue-200 bg-blue-50/60 text-blue-800',
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

function PhaseCell({ time, flagged, reason }: { time: string | null; flagged: boolean; reason: string | null }) {
  if (!time) {
    return (
      <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
        Missing
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
    </span>
  )
}

function ReportCard({
  title, subtitle, summary, missingCount, missingNames, tone,
}: {
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
    </div>
  )
}
