import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { londonDateISO } from '@/lib/dates'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { PrintToolbar } from '../PrintToolbar'
import { computeWeeklyAttendance, mondayOf, weekDatesFrom, type AttendanceRecord } from '@/lib/attendance/weeklyReport'

export const dynamic = 'force-dynamic'

function fmtDayLabel(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default async function PrintWeeklyAttendancePage({
  searchParams,
}: {
  searchParams: { start?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const today = londonDateISO()
  const rawStart = searchParams.start
  const anchor = rawStart && /^\d{4}-\d{2}-\d{2}$/.test(rawStart) && !isNaN(Date.parse(rawStart + 'T12:00:00Z'))
    ? rawStart
    : today
  const monday = mondayOf(anchor)
  const weekDates = weekDatesFrom(anchor) // Mon–Fri
  const friday = weekDates[4]
  const weekLabel = `${fmtDayLabel(monday)} – ${new Date(friday + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`

  const [{ data: students }, { data: records }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student').order('name'),
    admin
      .from('daily_attendance')
      .select('student_id, attendance_date, am_checked_at, lunch_checked_at, pm_checked_at, am_is_flagged, lunch_is_flagged, pm_is_flagged, am_flag_reason, lunch_flag_reason, pm_flag_reason')
      .in('attendance_date', weekDates),
  ])

  const { rows, cohortAvgPct, belowThreshold, flagNotes } = computeWeeklyAttendance(
    students ?? [],
    (records ?? []) as AttendanceRecord[],
    weekDates,
    today,
  )

  const generatedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="bg-white text-black min-h-screen p-6 max-w-[210mm] mx-auto print:p-0 print:max-w-none">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      <PrintToolbar backHref="/admin/attendance" />

      {/* Letterhead */}
      <header className="flex items-center justify-between border-b-2 border-black/80 pb-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tranmere Academy</h1>
          <p className="text-sm text-gray-600">Weekly Attendance Report</p>
        </div>
        <Image
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers"
          width={56}
          height={56}
          className="opacity-90"
        />
      </header>

      {/* Meta */}
      <section className="flex justify-between text-sm mb-5">
        <div>
          <p className="text-xs uppercase text-gray-500 tracking-wider">Week</p>
          <p className="font-bold text-base">{weekLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-gray-500 tracking-wider">Generated</p>
          <p className="font-medium">{generatedAt}</p>
        </div>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-3 gap-3 mb-5">
        <div className="border border-black/20 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Total students</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="border border-black/20 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Cohort attendance</p>
          <p className="text-2xl font-bold">{cohortAvgPct !== null ? `${cohortAvgPct}%` : '—'}</p>
        </div>
        <div className="border border-black/20 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Below 80%</p>
          <p className={`text-2xl font-bold ${belowThreshold.length > 0 ? 'text-red-600' : ''}`}>{belowThreshold.length}</p>
        </div>
      </section>

      {/* Roster */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-black/80 text-left">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Student</th>
            {weekDates.map(d => (
              <th key={d} className="py-2 pr-2 text-center">{fmtDayLabel(d)}</th>
            ))}
            <th className="py-2 pr-2 text-center">Week</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-black/10">
              <td className="py-1.5 pr-2 text-gray-500">{i + 1}</td>
              <td className="py-1.5 pr-2 font-medium">{r.name}</td>
              {r.days.map(d => (
                <td
                  key={d.dateISO}
                  className={`py-1.5 pr-2 text-center font-mono ${
                    d.isFuture ? 'text-gray-300' : d.checkedCount < 3 ? 'text-red-600 font-bold' : ''
                  }`}
                >
                  {d.isFuture ? '—' : `${d.checkedCount}/3`}
                </td>
              ))}
              <td className={`py-1.5 pr-2 text-center font-bold ${r.weekPct !== null && r.weekPct < 80 ? 'text-red-600' : ''}`}>
                {r.weekPct !== null ? `${r.weekPct}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[10px] text-gray-500 mt-2">
        Each day shows checks completed out of 3 (AM in / lunch / PM out). Week % counts only days that have already happened.
      </p>

      {/* Flagged notes */}
      {flagNotes.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-bold border-b border-black/30 pb-1 mb-2">Flagged check-ins this week</h2>
          <ul className="text-xs space-y-1">
            {flagNotes.map((n, i) => (
              <li key={i}>
                <span className="font-medium">{n.name}</span> — {fmtDayLabel(n.dateISO)} {n.phase}: {n.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sign-off line */}
      <footer className="mt-10 pt-6 border-t border-black/30 text-xs text-gray-500 flex justify-between">
        <span>Tranmere Academy · Solar Campus, 235 Leasowe Rd, Wallasey CH45 8RE</span>
        <span>Page 1</span>
      </footer>
    </div>
  )
}
